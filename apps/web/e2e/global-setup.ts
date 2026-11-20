import { APP_ORIGIN } from './paid-flow/endpoints';

// `next dev` compiles a route on its first request, which can take longer than a spec's own
// timeout. Visit the routes the specs open once, before any of them starts: signed out first,
// then signed in with a throwaway account, because the signed-in pages are the heavy ones.
const PUBLIC_ROUTES = [
  '/',
  '/es',
  '/pricing',
  '/credits',
  '/sign-up',
  '/sign-in',
  '/cookies',
  '/privacy',
  '/terms',
];
const SIGNED_IN_ROUTES = ['/dashboard', '/es/dashboard', '/library', '/credits', '/account'];

async function visit(path: string, cookie?: string) {
  await fetch(`${APP_ORIGIN}${path}`, {
    redirect: 'manual',
    headers: cookie ? { cookie } : {},
    signal: AbortSignal.timeout(120_000),
  }).catch(() => undefined);
}

export default async function warmUp() {
  for (const path of PUBLIC_ROUTES) await visit(path);
  const signUp = await fetch(`${APP_ORIGIN}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: APP_ORIGIN },
    body: JSON.stringify({
      email: `warm-up-${crypto.randomUUID()}@example.invalid`,
      name: 'Warm up',
      password: 'warm-up-password-123',
    }),
    signal: AbortSignal.timeout(120_000),
  }).catch(() => null);
  const cookie = signUp?.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  if (cookie) for (const path of SIGNED_IN_ROUTES) await visit(path, cookie);
}
