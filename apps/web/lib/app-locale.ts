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
