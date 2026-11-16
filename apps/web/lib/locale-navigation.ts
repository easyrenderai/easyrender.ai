import { DEFAULT_LOCALE, isRoutableLocale } from '@/i18n/config';

// The root layout's next-intl provider and marketing header survive client navigation.
// A locale boundary needs a new document, including / which can redirect by the home cookie.
export function needsDocumentNavigation(href: string, locale: string, pathname: string) {
  if (!href.startsWith('/') || href.startsWith('//')) return false;
  const target = href.split(/[?#]/)[0];
  const first = target.split('/')[1];
  const targetLocale = isRoutableLocale(first) ? first : DEFAULT_LOCALE;
  return targetLocale !== locale || (target === '/' && pathname !== '/');
}
