import 'server-only';
import { dash } from '@better-auth/infra';
import {
  REFERRAL_COOKIE,
  recordReferral,
  reportError,
  rewardReferral,
  serviceEmailAvailable,
  signupAttribution,
} from '@easyrender/core';
import { adminDecision } from '@easyrender/core/admin-analytics/helpers';
import { normalizeAttribution } from '@easyrender/core/attribution';
import { db } from '@easyrender/db';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import {
  APIError,
  addOAuthServerContext,
  createAuthMiddleware,
  getOAuthState,
  getSessionFromCtx,
} from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { privacyRegion } from '@/lib/analytics/privacy-region';
import { BOT_BLOCKED_CODE, BOT_BLOCKED_MESSAGE, isBlockedBot } from '@/lib/bot-check';
import { queueAuthServiceEmail } from '@/lib/service-email';

const cookieValue = (headers: Headers, name: string) =>
  headers.get('cookie')?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1] ?? null;

function createAuth() {
  return betterAuth({
    database: prismaAdapter(db(), { provider: 'postgresql' }),
    // Existing Better Auth state cookie carries only its CSRF nonce; attribution stays in DB state.
    account: { storeStateStrategy: 'database' },
    user: {
      validateUserInfo: async ({ user, source }, ctx) => {
        if (source.oauth?.providerId !== 'google') return;
        const state = await getOAuthState();
        const isExplicitLink = source.action === 'link-account' && Boolean(state?.link);
        const recoverySessionId = state?.serverContext?.adminRecoverySessionId;
        if (!isExplicitLink && !recoverySessionId) return;
        const session = await getSessionFromCtx(ctx);
        const expectedSessionId = isExplicitLink
          ? state?.serverContext?.googleLinkSessionId
          : recoverySessionId;
        // Check the live initiating session and Google's verified email before any account write.
        if (
          !session ||
          session.session.id !== expectedSessionId ||
          user.emailVerified !== true ||
          user.email?.toLowerCase() !== session.user.email.toLowerCase() ||
          (isExplicitLink && state?.link?.userId !== session.user.id)
        )
          return { error: 'google_account_verification_failed' };
        if (
          recoverySessionId &&
          adminDecision(session.user, process.env.ADMIN_EMAILS ?? '') !== 'allow'
        )
          return { error: 'admin_access_required' };
      },
    },
    // Hash recovery bearer tokens without changing OAuth state identifiers.
    verification: {
      storeIdentifier: { default: 'plain', overrides: { 'reset-password:': 'hashed' } },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // Automated clients cannot create accounts or guess passwords in bulk. Runs before the
        // email is looked up, so a blocked request creates nothing and tells nothing.
        if (
          (ctx.path === '/sign-up/email' || ctx.path === '/sign-in/email') &&
          (await isBlockedBot())
        )
          throw new APIError('FORBIDDEN', {
            code: BOT_BLOCKED_CODE.toUpperCase(),
            message: BOT_BLOCKED_MESSAGE,
          });
        if (ctx.path === '/link-social' && ctx.body?.provider === 'google') {
          const session = await getSessionFromCtx(ctx);
          if (!session)
            throw new APIError('UNAUTHORIZED', { message: 'Sign in before linking Google' });
          // The redirect flow supplies state/PKCE/nonce and a live-session check on its callback.
          if (ctx.body.idToken)
            throw new APIError('BAD_REQUEST', { message: 'Use the Google redirect flow' });
          await addOAuthServerContext({ googleLinkSessionId: session.session.id });
          ctx.body.additionalData = {};
          return;
        }
        if (ctx.path === '/send-verification-email') {
          const session = await getSessionFromCtx(ctx);
          if (!session)
            throw new APIError('UNAUTHORIZED', {
              code: 'UNAUTHORIZED',
              message: 'Sign in to request verification',
            });
          if (
            typeof ctx.body?.email !== 'string' ||
            ctx.body.email.trim().toLowerCase() !== session.user.email.toLowerCase()
          )
            throw new APIError('FORBIDDEN', {
              code: 'EMAIL_MISMATCH',
              message: 'Use your account email',
            });
        }
        if (ctx.path === '/request-password-reset' || ctx.path === '/send-verification-email') {
          // Check before looking up an address: unavailable is the same for every account.
          if (!serviceEmailAvailable())
            throw new APIError('SERVICE_UNAVAILABLE', {
              code: 'SERVICE_EMAIL_UNAVAILABLE',
              message: 'Service email is temporarily unavailable',
            });
          const callback =
            ctx.path === '/request-password-reset' ? ctx.body?.redirectTo : ctx.body?.callbackURL;
          if (callback) {
            const base = new URL(process.env.APP_URL ?? ctx.context.baseURL);
            const target = new URL(callback, base.origin);
            if (target.origin !== base.origin || target.username || target.password)
              throw new APIError('FORBIDDEN', {
                code: 'INVALID_CALLBACK_URL',
                message: 'Invalid callback origin',
              });
          }
        }
        if (ctx.path !== '/sign-in/social') return;
        const h = ctx.headers ?? new Headers();
        let adminRecoverySessionId: string | undefined;
        if (ctx.body?.additionalData?.adminRecovery === true) {
          const session = await getSessionFromCtx(ctx);
          if (
            !session ||
            ctx.body.provider !== 'google' ||
            adminDecision(session.user, process.env.ADMIN_EMAILS ?? '') !== 'allow'
          )
            throw new APIError('FORBIDDEN', { message: 'Sign in with your admin account first' });
          adminRecoverySessionId = session.session.id;
        }
        await addOAuthServerContext({
          ...(adminRecoverySessionId ? { adminRecoverySessionId } : {}),
          attribution: normalizeAttribution(
            ctx.body?.additionalData?.attribution,
            ctx.context.baseURL,
            privacyRegion(h),
          ),
          anonId: h.get('cookie')?.match(/(?:^|;\s*)er_anon=([^;]+)/)?.[1] ?? null,
          referralCode: cookieValue(h, REFERRAL_COOKIE),
        });
        // Only the normalized server context enters state; never persist raw client extras.
        ctx.body.additionalData = {};
      }),
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user, ctx) => {
            const state = await getOAuthState();
            const h = ctx?.headers ?? new Headers();
            const stored = state?.serverContext;
            const attribution = stored?.attribution
              ? (stored.attribution as ReturnType<typeof normalizeAttribution>)
              : normalizeAttribution(
                  ctx?.body?.attribution,
                  ctx?.context.baseURL ?? 'https://easyrender.ai',
                  privacyRegion(h),
                );
            await signupAttribution({
              userId: user.id,
              attribution,
              anonId:
                typeof stored?.anonId === 'string'
                  ? stored.anonId
                  : (h.get('cookie')?.match(/(?:^|;\s*)er_anon=([^;]+)/)?.[1] ?? null),
              method: ctx?.path?.includes('callback') ? 'google' : 'email',
            });
            // The code comes from the cookie the sign up link set, never from the form body.
            await recordReferral({
              userId: user.id,
              code:
                typeof stored?.referralCode === 'string'
                  ? stored.referralCode
                  : cookieValue(h, REFERRAL_COOKIE),
            });
            // Google accounts arrive verified; email accounts are paid when they verify.
            if (user.emailVerified) await rewardReferral(user.id);
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      requireEmailVerification: false,
      resetPasswordTokenExpiresIn: 3600,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async (data, request) => {
        try {
          await queueAuthServiceEmail('reset_password', data, request);
        } catch {
          reportError(new Error('Password recovery email could not be queued'));
        }
      },
    },
    emailVerification: {
      sendOnSignUp: serviceEmailAvailable(),
      sendOnSignIn: false,
      autoSignInAfterVerification: false,
      afterEmailVerification: async (user) => {
        await rewardReferral(user.id);
      },
      expiresIn: 3600,
      sendVerificationEmail: async (data, request) => {
        try {
          await queueAuthServiceEmail('verify_email', data, request);
        } catch {
          reportError(new Error('Account verification email could not be queued'));
          // Signup and social sign-in remain usable; an explicit authenticated resend is honest.
          if (request && new URL(request.url).pathname.endsWith('/send-verification-email'))
            throw new APIError('SERVICE_UNAVAILABLE', {
              code: 'SERVICE_EMAIL_UNAVAILABLE',
              message: 'Service email is temporarily unavailable',
            });
        }
      },
    },
    rateLimit: {
      enabled: true,
      customRules: {
        '/request-password-reset': { window: 300, max: 5 },
        '/send-verification-email': { window: 300, max: 3 },
        '/reset-password': { window: 300, max: 10 },
      },
    },
    // Callback: ${BETTER_AUTH_URL}/api/auth/callback/google. Set GOOGLE_CLIENT_ID and
    // GOOGLE_CLIENT_SECRET in Vercel; without them Google sign in is simply not registered.
    socialProviders:
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: process.env.GOOGLE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET,
              prompt: 'select_account',
            },
          }
        : {},
    // Sign-in posts from whichever domain the visitor is on; without this only BETTER_AUTH_URL's
    // origin is accepted and every other one gets 403 INVALID_ORIGIN.
    trustedOrigins: [
      'https://easyrender.ai',
      'https://www.easyrender.ai',
      ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ],
    // dash() reads BETTER_AUTH_API_KEY; it powers the hosted Better Auth dashboard.
    plugins: [dash(), nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;
let instance: Auth | null = null;

// Lazy so `next build` does not need a database connection.
export const auth = (): Auth => {
  instance ??= createAuth();
  return instance;
};
