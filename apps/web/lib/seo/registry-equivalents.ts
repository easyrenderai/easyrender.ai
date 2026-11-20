import type { Locale } from '@/i18n/config';
import { livePaths, ROUTE_KEYS } from './routes';

// The part of the language picker that needs nothing but the route registry, so the browser can
// compute it. Posts and comparisons live in content files and are answered by the server
// (lib/seo/equivalents.ts, /api/locale-options).

export type Equivalent = { locale: Locale; path: string };

export const toList = (paths: Partial<Record<Locale, string>>): Equivalent[] =>
  (Object.entries(paths) as [Locale, string][]).map(([locale, path]) => ({ locale, path }));

/** The page in every language when its path is in the registry, otherwise null. */
export function registryEquivalents(pathname: string): Equivalent[] | null {
  const path = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  for (const key of ROUTE_KEYS) {
    const paths = livePaths(key);
    if (Object.values(paths).includes(path)) return toList(paths);
  }
  return null;
}

/** What the picker lists given this page's own equivalents: them, or the homes with this page kept. */
export function pickerFrom(own: Equivalent[]): Equivalent[] {
  if (own.length >= 2) return own;
  const homes = toList(livePaths('home'));
  const [page] = own;
  return page ? homes.map((home) => (home.locale === page.locale ? page : home)) : homes;
}

/** The homes of every language: the picker's answer for a page it knows nothing about. */
export const homeEquivalents = (): Equivalent[] => toList(livePaths('home'));
