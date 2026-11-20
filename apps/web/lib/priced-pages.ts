import { LOCALES } from '@/i18n/config';
import { ROUTES } from '@/lib/seo/routes';

// The pages whose HTML contains an amount of money, in every language: they are built once per
// pricing key. The route registry is the only list of their public paths.
export const PRICED_ROUTE_KEYS = ['home', 'pricing', 'models', 'ecommerce', 'api'] as const;

const PRICED_PATHS: ReadonlySet<string> = new Set(
  PRICED_ROUTE_KEYS.flatMap((key) => LOCALES.map((locale) => ROUTES[key].paths[locale])),
);

/** True when `pathname` is the public URL of a priced page in some language. */
export function isPricedPage(pathname: string): boolean {
  const path = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return PRICED_PATHS.has(path);
}
