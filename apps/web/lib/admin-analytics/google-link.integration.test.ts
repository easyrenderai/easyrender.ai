import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { grantCredits } from '@easyrender/core';
import { adminDecision } from '@easyrender/core/admin-analytics/helpers';
import { db } from '@easyrender/db';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@better-auth/infra', () => ({ dash: () => ({ id: 'local-no-dashboard' }) }));
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl) {
  if (!['localhost', '127.0.0.1'].includes(new URL(databaseUrl).hostname))
    throw new Error('Use a local scratch database');
  process.env.DATABASE_URL = databaseUrl;
}
const origin = 'http://localhost:3100';
const users: string[] = [];
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
let googleToken = '';
let fixtureIp = 1;
const cookies = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');

async function post(path: string, body: object, cookie = '') {
  const { auth } = await import('@/lib/auth');
  return auth().handler(
    new Request(`${origin}/api/auth/${path}`, {
      method: 'POST',
      headers: {
        origin,
        'content-type': 'application/json',
        cookie,
        'x-forwarded-for': `192.0.2.${fixtureIp++}`,
      },
      body: JSON.stringify(body),
    }),
  );
}
async function account() {
  const email = `admin-link-${randomUUID()}@example.invalid`;
  users.push(email);
  const response = await post('sign-up/email', {
    email,
    name: 'Local test',
    password: 'Local-only-fixture-password-123!',
  });
  expect(response.status).toBe(200);
  const user = await db().user.findUniqueOrThrow({ where: { email } });
  return { ...user, cookie: cookies(response) };
}
async function start(path: 'link-social' | 'sign-in/social', cookie = '', isAdminRecovery = false) {
  const response = await post(
    path,
    {
      provider: 'google',
      callbackURL: `${origin}/admin/analytics?period=90d`,
      errorCallbackURL: `${origin}/sign-in/admin`,
      additionalData: isAdminRecovery ? { adminRecovery: true } : {},
    },
    cookie,
  );
  expect(response.status).toBe(200);
  return { url: new URL((await response.json()).url), cookie: cookies(response) };
}
async function callback(
  flow: Awaited<ReturnType<typeof start>>,
  email: string,
  subject: string,
  cookie: string,
  isVerified = true,
) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({ alg: 'RS256', kid: 'admin-link-fixture' })}.${encode({
    iss: 'https://accounts.google.com',
    aud: 'admin-link-client',
    sub: subject,
    iat: now,
    exp: now + 300,
    nonce: flow.url.searchParams.get('nonce'),
    email,
    email_verified: isVerified,
    name: 'Local Google test',
  })}`;
  googleToken = `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`;
  const { auth } = await import('@/lib/auth');
  return auth().handler(
    new Request(
      `${origin}/api/auth/callback/google?state=${flow.url.searchParams.get('state')}&code=local-only-code`,
      {
        headers: { cookie: [cookie, flow.cookie].filter(Boolean).join('; ') },
      },
    ),
  );
}

describe.skipIf(!databaseUrl)(
  'Google recovery using real auth handlers and signed provider fixtures',
  () => {
    beforeAll(() => {
      for (const [key, value] of Object.entries({
        BETTER_AUTH_URL: origin,
        APP_URL: origin,
        BETTER_AUTH_SECRET: 'local-google-link-secret-never-production-123456789',
        GOOGLE_CLIENT_ID: 'admin-link-client',
        GOOGLE_CLIENT_SECRET: 'local-only-client-secret',
        BETTER_AUTH_API_KEY: '',
        NEXT_PUBLIC_POSTHOG_KEY: '',
        NEXT_PUBLIC_SENTRY_DSN: '',
        SERVICE_EMAIL_ENABLED: 'false',
        EMAIL_ONBOARDING_ENABLED: 'false',
        VERCEL_ENV: 'preview',
      }))
        vi.stubEnv(key, value);
      vi.stubGlobal('fetch', async (input: string | URL | Request) => {
        const target = input instanceof Request ? input.url : String(input);
        if (target === 'https://oauth2.googleapis.com/token')
          return Response.json({
            access_token: 'local-only-access',
            token_type: 'Bearer',
            expires_in: 300,
            id_token: googleToken,
          });
        if (target === 'https://www.googleapis.com/oauth2/v3/certs')
          return Response.json({
            keys: [
              {
                ...publicKey.export({ format: 'jwk' }),
                kid: 'admin-link-fixture',
                alg: 'RS256',
                use: 'sig',
              },
            ],
          });
        throw new Error('Unexpected network request in OAuth fixture');
      });
    });
    afterAll(async () => {
      await db().user.deleteMany({ where: { email: { in: users } } });
      await db().$disconnect();
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    });

    it('requires a session for linking and rejects the alternate ID-token linking path', async () => {
      const anonymous = await post('link-social', { provider: 'google' });
      expect(anonymous.status).toBe(401);
      const user = await account();
      const direct = await post(
        'link-social',
        { provider: 'google', idToken: { token: 'not-a-provider-token' } },
        user.cookie,
      );
      expect(direct.status).toBe(400);
      expect(await db().account.count({ where: { userId: user.id, providerId: 'google' } })).toBe(
        0,
      );
    });

    it('requires an allowlisted session before starting admin recovery', async () => {
      const user = await account();
      vi.stubEnv('ADMIN_EMAILS', 'another-admin@example.invalid');
      const response = await post(
        'sign-in/social',
        { provider: 'google', additionalData: { adminRecovery: true } },
        user.cookie,
      );
      expect(response.status).toBe(403);
    });

    it('preserves the default block on implicit linking of an unverified existing account', async () => {
      const user = await account();
      const response = await callback(
        await start('sign-in/social', user.cookie),
        user.email,
        randomUUID(),
        user.cookie,
      );
      expect(new URL(response.headers.get('location') ?? '').searchParams.get('error')).toBe(
        'account_not_linked',
      );
      expect(await db().account.count({ where: { userId: user.id, providerId: 'google' } })).toBe(
        0,
      );
    });

    it('links with a live session, then verifies by Google sign-in while preserving account assets', async () => {
      const user = await account();
      vi.stubEnv('ADMIN_EMAILS', user.email);
      await grantCredits({
        userId: user.id,
        amount: 123,
        key: `fixture:${user.id}`,
        reason: 'Local test only',
      });
      const render = await db().render.create({
        data: { userId: user.id, sourceKey: 'local-fixture-only', status: 'ready' },
      });
      const subject = randomUUID();
      const linked = await callback(
        await start('link-social', user.cookie),
        user.email,
        subject,
        user.cookie,
      );
      expect(linked.headers.get('location')).toBe(`${origin}/admin/analytics?period=90d`);
      expect(await db().account.count({ where: { userId: user.id, providerId: 'google' } })).toBe(
        1,
      );
      expect((await db().user.findUniqueOrThrow({ where: { id: user.id } })).emailVerified).toBe(
        false,
      );
      const signedIn = await callback(
        await start('sign-in/social', user.cookie, true),
        user.email,
        subject,
        user.cookie,
      );
      expect(signedIn.headers.get('location')).toBe(`${origin}/admin/analytics?period=90d`);
      const { auth } = await import('@/lib/auth');
      const session = await auth().api.getSession({
        headers: new Headers({ cookie: cookies(signedIn) }),
      });
      expect(session?.user).toMatchObject({ id: user.id, email: user.email, emailVerified: true });
      expect(adminDecision(session?.user ?? null, user.email, true)).toBe('allow');
      expect((await db().user.findUniqueOrThrow({ where: { id: user.id } })).credits).toBe(123);
      expect((await db().render.findUniqueOrThrow({ where: { id: render.id } })).userId).toBe(
        user.id,
      );
      expect(await db().user.count({ where: { email: user.email } })).toBe(1);
      await db().render.delete({ where: { id: render.id } });
    });

    it.each(['missing', 'revoked', 'switched'] as const)(
      'rejects a %s session at the linking callback',
      async (mode) => {
        const user = await account();
        const flow = await start('link-social', user.cookie);
        let cookie = user.cookie;
        if (mode === 'missing') cookie = '';
        if (mode === 'revoked') await db().session.deleteMany({ where: { userId: user.id } });
        if (mode === 'switched') cookie = (await account()).cookie;
        const response = await callback(flow, user.email, randomUUID(), cookie);
        expect(new URL(response.headers.get('location') ?? '').searchParams.has('error')).toBe(
          true,
        );
        expect(await db().account.count({ where: { userId: user.id, providerId: 'google' } })).toBe(
          0,
        );
        expect((await db().user.findUniqueOrThrow({ where: { id: user.id } })).emailVerified).toBe(
          false,
        );
      },
    );

    it.each(['different-email', 'unverified-email'] as const)(
      'rejects Google proof with %s',
      async (mode) => {
        const user = await account();
        const response = await callback(
          await start('link-social', user.cookie),
          mode === 'different-email' ? 'someone-else@example.invalid' : user.email,
          randomUUID(),
          user.cookie,
          mode !== 'unverified-email',
        );
        expect(new URL(response.headers.get('location') ?? '').searchParams.has('error')).toBe(
          true,
        );
        expect(await db().account.count({ where: { userId: user.id, providerId: 'google' } })).toBe(
          0,
        );
      },
    );

    it('does not create a second user when a different Google account is chosen in the verification step', async () => {
      const user = await account();
      vi.stubEnv('ADMIN_EMAILS', user.email);
      const otherEmail = `wrong-google-${randomUUID()}@example.invalid`;
      users.push(otherEmail);
      const response = await callback(
        await start('sign-in/social', user.cookie, true),
        otherEmail,
        randomUUID(),
        user.cookie,
      );
      expect(new URL(response.headers.get('location') ?? '').searchParams.has('error')).toBe(true);
      expect(await db().user.findUnique({ where: { email: otherEmail } })).toBeNull();
    });
  },
);
