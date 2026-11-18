import 'server-only';
import { createHash } from 'node:crypto';
import {
  type Actor,
  type ApiKeyScope,
  AppError,
  assertActorScope,
  bearerToken,
  consumeApiRateLimit,
  verifyApiKeyPrincipal,
} from '@easyrender/core';
import { headers as nextHeaders } from 'next/headers';
import { isRoutableLocale } from '@/i18n/config';
import { privacyRegion } from '@/lib/analytics/privacy-region';
import { APP_LOCALE_COOKIE } from '@/lib/app-locale';
import { auth } from './auth';

export const ANON_COOKIE = 'er_anon';

function readCookie(headers: Headers, name: string): string | null {
  const match = headers.get('cookie')?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function ipHash(headers: Headers): string | null {
  const ip = headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip');
  if (!ip) return null;
  return createHash('sha256')
    .update(`${ip}:${process.env.BETTER_AUTH_SECRET ?? ''}`)
    .digest('hex')
    .slice(0, 32);
}

// A request is made by an API key holder, a signed-in user, an anonymous visitor, or a mix.
export async function resolveActor(headers?: Headers, scope: ApiKeyScope = 'read'): Promise<Actor> {
  const h = headers ?? (await nextHeaders());
  const base = {
    anonId: readCookie(h, ANON_COOKIE),
    ipHash: ipHash(h),
    geoCountry: privacyRegion(h).country,
  };
  const token = bearerToken(h);
  if (h.has('authorization')) {
    const principal = await verifyApiKeyPrincipal(token);
    if (!principal) throw new AppError('Invalid or expired API key', 401, 'unauthorized');
    const actor = {
      ...base,
      userId: principal.userId,
      apiKeyId: principal.id,
      source: 'api' as const,
      apiKeyScopes: principal.scopes,
    };
    assertActorScope(actor, scope);
    await consumeApiRateLimit(`api:${principal.id}`, 120);
    return actor;
  }
  const session = await auth().api.getSession({ headers: h });
  const locale = readCookie(h, APP_LOCALE_COOKIE);
  return {
    ...base,
    userId: session?.user.id ?? null,
    source: 'web',
    locale: isRoutableLocale(locale) ? locale : undefined,
  };
}

// Pages are for people. A request with a stale or wrong Authorization header (a crawler, an agent
// replaying a key) is shown the page as an anonymous visitor instead of failing the render with a
// 500. API routes keep calling `resolveActor`, which still rejects a bad key.
export async function resolveViewerActor(): Promise<Actor> {
  const h = await nextHeaders();
  try {
    return await resolveActor(h);
  } catch (error) {
    if (!(error instanceof AppError) || error.status !== 401) throw error;
    const withoutKey = new Headers(h);
    withoutKey.delete('authorization');
    return resolveActor(withoutKey);
  }
}

export async function currentUser() {
  const session = await auth().api.getSession({ headers: await nextHeaders() });
  return session?.user ?? null;
}

// The signed-in person for a route that a browser session, never an API key, may call.
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new AppError('Sign in first', 401, 'unauthorized');
  return user;
}
