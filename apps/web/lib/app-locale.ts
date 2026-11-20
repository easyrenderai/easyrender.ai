import { isCreditInviteId } from '@easyrender/core/credit-gift-policy';
import { DEFAULT_LOCALE, isRoutableLocale, type Locale } from '@/i18n/config';

export const APP_LOCALE_COOKIE = 'er_app_locale';

export function localizedAuthPath(locale: string, path: '/sign-in' | '/sign-up') {
  return isRoutableLocale(locale) && locale !== DEFAULT_LOCALE ? `/${locale}${path}` : path;
}

const APP_SECTIONS = new Set([
  'dashboard',
  'library',
  'views',
  'r',
  'ar',
  'credits',
  'account',
  'connectors',
  'hub',
  'explore',
  'shopify',
  'oauth',
  'forgot-password',
  'reset-password',
  'verify-email',
  'invite',
]);

export const isAppLocalePath = (pathname: string) => APP_SECTIONS.has(pathname.split('/')[1] ?? '');

/**
 * The language of the marketing page a visitor just came from, when it is not English: /es/precios
 * to /credits opens the app in Spanish. A marketing page is cached and cannot set the preference
 * cookie, and the visitor's /api/viewer call may not have answered yet, so the page they clicked
 * from is the answer. English pages have no prefix to read, so they leave the cookie in charge.
 */
export function refererLocale(referer: string | null, hosts: readonly string[]): Locale | null {
  if (!referer) return null;
  try {
    const url = new URL(referer);
    if (!hosts.includes(url.host.toLowerCase())) return null;
    const segment = url.pathname.split('/')[1];
    return isRoutableLocale(segment) && segment !== DEFAULT_LOCALE ? segment : null;
  } catch {
    return null;
  }
}

export function requestLocale(pathname: string, choice: unknown, preference: unknown): Locale {
  const segment = pathname.split('/')[1];
  if (isRoutableLocale(segment)) return segment;
  if (!isAppLocalePath(pathname)) return DEFAULT_LOCALE;
  if (isRoutableLocale(choice)) return choice;
  return isRoutableLocale(preference) ? preference : DEFAULT_LOCALE;
}

/** Account links can return only to same-origin pages. */
export function authReturnPath(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 2048 || !raw.startsWith('/')) return null;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: reject control characters in redirect input.
  if (raw.startsWith('//') || raw.includes('\\') || /[\u0000-\u001f\u007f]/.test(raw)) return null;
  return raw;
}

export function localizedSignInPath(locale: string, next: string) {
  return `${localizedAuthPath(locale, '/sign-in')}?next=${encodeURIComponent(next)}`;
}

/** Verification and recovery can resume a project, never an arbitrary action endpoint. */
export function authProjectPath(raw: unknown): string | null {
  if (typeof raw === 'string' && raw.startsWith('/invite/') && isCreditInviteId(raw.slice(8)))
    return raw;
  return typeof raw === 'string' && /^\/(?:r\/[A-Za-z0-9_-]+|views(?:\/[A-Za-z0-9_-]+)?)$/.test(raw)
    ? raw
    : null;
}
