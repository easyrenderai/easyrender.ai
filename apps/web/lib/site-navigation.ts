import type { Locale } from '@/i18n/config';
import { isPublished, ROUTES } from '@/lib/seo/routes';

// Anchors are relative to the home of the visitor's language, so nothing here leaves the branch
// they are reading. /hub is the same page in every language (product, English, noindex).
const NAV = [
  { hash: '#how-it-works', key: 'howItWorks' },
  { href: '/hub', key: 'hub' },
  { hash: '#connect', key: 'connect' },
  { route: 'mcp', key: 'mcp' },
  { route: 'api', key: 'api' },
  { hash: '#try', key: 'try' },
  { route: 'pricing', key: 'pricing' },
] as const;

// Do not link to integrations before their localized landing is published.
export function siteNavigation(locale: Locale) {
  return NAV.filter((item) => {
    if ('route' in item && item.route !== 'pricing') return isPublished(item.route, locale);
    return item.key !== 'connect' || !isPublished('mcp', locale);
  });
}

export function headerSectionHref(locale: Locale, path: string | null, hash: string) {
  const isIntegrationPage = (['api', 'mcp'] as const).some(
    (route) => isPublished(route, locale) && path === ROUTES[route].paths[locale],
  );
  const isLocalSection = hash === '#connect' || hash === '#how-it-works';
  return `${isIntegrationPage && isLocalSection ? path : ROUTES.home.paths[locale]}${hash}`;
}

export function headerPrimaryAction(locale: Locale, path: string | null, isSignedIn: boolean) {
  if (path === ROUTES.home.paths[locale]) {
    return { kind: 'upload', href: `${path}#try` } as const;
  }
  for (const kind of ['api', 'mcp'] as const) {
    if (isPublished(kind, locale) && path === ROUTES[kind].paths[locale]) {
      return { kind, href: `${path}#connect` };
    }
  }
  return isSignedIn
    ? ({ kind: 'dashboard', href: '/dashboard' } as const)
    : ({ kind: 'mcp', href: `${ROUTES.home.paths[locale]}#connect` } as const);
}
