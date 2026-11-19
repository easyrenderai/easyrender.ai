import { adminDecision } from '@easyrender/core/admin-analytics/helpers';
import {
  normalizeReferralCode,
  REFERRAL_COOKIE,
  REFERRAL_COOKIE_MAX_AGE,
} from '@easyrender/core/referral-code';
import { type NextRequest, NextResponse } from 'next/server';
import { isRoutableLocale, LOCALE_HEADER, PATH_HEADER } from './i18n/config';
import { adminVerificationPath } from './lib/admin-analytics/navigation';
import { APP_LOCALE_COOKIE, isAppLocalePath, requestLocale } from './lib/app-locale';
import { canonicalHostTarget } from './lib/canonical-host';
import {
  COUNTRY_HEADER,
  decideHome,
  HOME_LOCALE_COOKIE,
  HOME_LOCALE_MAX_AGE,
  HOME_VARY,
  homePath,
} from './lib/home-locale';

import { isMailingTokenLocation, PRIVATE_TOKEN_PAGE_HEADER } from './lib/mailing-privacy';

const ANON_COOKIE = 'er_anon';

/** Sends www, easyrenderai.vercel.app and other aliases of production to https://easyrender.ai. */
function canonicalHostRedirect(request: NextRequest): NextResponse | null {
  const target = canonicalHostTarget({
    method: request.method,
    url: request.nextUrl.toString(),
    host: request.headers.get('host'),
    vercelEnv: process.env.VERCEL_ENV,
    deploymentHost: process.env.VERCEL_URL,
  });
  return target ? NextResponse.redirect(target, 301) : null;
}

/** Adds the headers the redirect depends on, so no cache serves one visitor's answer to another. */
function varyHome(response: NextResponse): NextResponse {
  const current = response.headers.get('vary');
  const values = new Set([
    ...(current ? current.split(',').map((value) => value.trim()) : []),
    ...HOME_VARY,
  ]);
  response.headers.set('vary', [...values].filter(Boolean).join(', '));
  return response;
}

const homeCookie = (request: NextRequest) => ({
  // Not httpOnly: the language picker writes it from the browser on click.
  httpOnly: false,
  sameSite: 'lax' as const,
  secure: request.nextUrl.protocol === 'https:',
  path: '/',
  maxAge: HOME_LOCALE_MAX_AGE,
});

/**
 * The first-visit language of the marketing root, see lib/home-locale.ts. A 307, never a 301:
 * the answer depends on who asks, so neither browsers nor crawlers may remember it.
 */
function homeRedirect(request: NextRequest) {
  const decision = decideHome({
    method: request.method,
    pathname: request.nextUrl.pathname,
    host: request.headers.get('host'),
    country: request.headers.get(COUNTRY_HEADER),
    userAgent: request.headers.get('user-agent'),
    cookie: request.cookies.get(HOME_LOCALE_COOKIE)?.value ?? null,
    referer: request.headers.get('referer'),
    // Only a browser-level prefetch is visible here. Next.js strips its own RSC headers and the
    // `_rsc` query before the proxy runs, and turns a redirect of a router fetch into
    // x-nextjs-redirect, which the router follows to the same home.
    isRouterRequest:
      request.headers.get('purpose') === 'prefetch' ||
      request.headers.get('sec-purpose')?.includes('prefetch') === true,
  });
  if (decision.kind !== 'redirect') return decision;

  const target = request.nextUrl.clone();
  target.pathname = homePath(decision.locale);
  const response = NextResponse.redirect(target, 307);
  response.headers.set('cache-control', 'private, no-store');
  if (decision.cookie)
    response.cookies.set(HOME_LOCALE_COOKIE, decision.cookie, homeCookie(request));
  return varyHome(response);
}

// Canonical host first, then the first-visit language of the root, then an anonymous id for every
// visitor so a free preview can be tied to them before sign up, then the locale of the URL for
// the layout and next-intl to read.
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/admin' || request.nextUrl.pathname.startsWith('/admin/')) {
    return adminResponse(request);
  }
  const redirect = canonicalHostRedirect(request);
  if (redirect) return redirect;

  const home = homeRedirect(request);
  if (home instanceof NextResponse) return home;

  const headers = new Headers(request.headers);
  const { pathname, searchParams } = request.nextUrl;
  const isApp = isAppLocalePath(pathname);
  const isPrivateTokenPage = isMailingTokenLocation(request.nextUrl.href);
  const saved = request.cookies.get(APP_LOCALE_COOKIE)?.value;
  const locale = requestLocale(
    pathname,
    searchParams.get('locale'),
    saved ?? request.cookies.get(HOME_LOCALE_COOKIE)?.value,
  );
  headers.set(LOCALE_HEADER, locale);
  headers.set(PATH_HEADER, pathname);
  headers.set(PRIVATE_TOKEN_PAGE_HEADER, isPrivateTokenPage ? '1' : '0');

  const response = withAnonymousId(request, headers);
  // A share link (?ref=CODE) is remembered, so the code survives navigation and Google sign in.
  const referral = normalizeReferralCode(searchParams.get('ref'));
  if (referral && request.method === 'GET')
    response.cookies.set(REFERRAL_COOKIE, referral, {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: REFERRAL_COOKIE_MAX_AGE,
    });
  const destination = request.headers.get('sec-fetch-dest');
  const isDocument =
    request.method === 'GET' &&
    (destination === 'document' ||
      (!destination && request.headers.get('accept')?.includes('text/html')));
  // App pages can depend on a browser preference. Indexable pages always use their URL.
  if (isApp || isPrivateTokenPage) response.headers.set('Cache-Control', 'private, no-store');
  if (isPrivateTokenPage) response.headers.set('Referrer-Policy', 'no-referrer');
  if (
    isDocument &&
    saved !== locale &&
    (isApp ||
      isRoutableLocale(pathname.split('/')[1]) ||
      (!/^\/(?:api|_next)(?:\/|$)/.test(pathname) && !pathname.includes('.')))
  ) {
    response.cookies.set(APP_LOCALE_COOKIE, locale, { ...homeCookie(request), httpOnly: true });
    response.headers.set('Cache-Control', 'private, no-store');
  }
  // The English root after an explicit choice of English. Its Vary is the page's own: Next.js
  // replaces it, and the dynamic page is served private, no-store, so no shared cache keeps it.
  if (home.kind === 'stay' && home.cookie) {
    response.cookies.set(HOME_LOCALE_COOKIE, home.cookie, homeCookie(request));
  }
  return response;
}

async function adminResponse(request: NextRequest) {
  const { adminSession } = await import('./lib/admin-analytics/session');
  const session = await adminSession(request.headers);
  const decision = adminDecision(session?.user ?? null, process.env.ADMIN_EMAILS ?? '', true);
  const headers = new Headers(request.headers);
  headers.set(LOCALE_HEADER, 'en');
  headers.set(PATH_HEADER, request.nextUrl.pathname);
  headers.set('x-admin-return', request.nextUrl.pathname + request.nextUrl.search);
  let response: NextResponse;
  if (decision === 'signin') {
    const target = new URL('/sign-in', request.url);
    target.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
    response = NextResponse.redirect(target);
  } else if (decision === 'verify') {
    response = NextResponse.redirect(
      new URL(
        adminVerificationPath(request.nextUrl.pathname + request.nextUrl.search),
        request.url,
      ),
    );
  } else if (decision === 'notFound') response = new NextResponse(null, { status: 404 });
  else response = NextResponse.next({ request: { headers } });
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

function withAnonymousId(request: NextRequest, headers: Headers): NextResponse {
  const anon = request.cookies.get(ANON_COOKIE)?.value;
  if (anon) return NextResponse.next({ request: { headers } });

  const id = crypto.randomUUID();
  const cookie = request.headers.get('cookie');
  headers.set('cookie', `${cookie ? `${cookie}; ` : ''}${ANON_COOKIE}=${id}`);

  const response = NextResponse.next({ request: { headers } });
  response.cookies.set(ANON_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export const config = {
  // robots.txt, the sitemaps, llms.txt and llms-full.txt are served by route handlers that need neither the
  // anonymous cookie nor a locale, so they stay out of the proxy entirely.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots\\.txt|sitemap.*\\.xml|llms.*\\.txt|api/webhooks|api/mcp|api/oauth|monitoring|\\.well-known).*)',
  ],
};
