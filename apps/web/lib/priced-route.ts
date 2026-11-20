// Marketing pages that quote money exist once per pricing key (currency and arm), under
// /p/{key}/..., and no visitor ever sees that prefix: proxy.ts rewrites the public URL to it and
// redirects a direct request back. No imports, so the browser can use it too.

const PRICED_PREFIX = '/p';

const PREFIX = /^\/p\/(?:usd|eur)\.(?:control|test)(\/.*)?$/;

/** `/p/eur.control/preise` becomes `/preise`; any other path comes back unchanged. */
export function publicPath(pathname: string): string {
  const match = PREFIX.exec(pathname);
  return match ? (match[1] ?? '/') : pathname;
}

/** The internal path of a public one: `/pricing` with `eur.control` is `/p/eur.control/pricing`. */
export const pricedPath = (key: string, pathname: string): string =>
  `${PRICED_PREFIX}/${key}${pathname === '/' ? '' : pathname}`;

/** True for a path that is the internal form of a priced page, which nobody may request directly. */
export const isPricedInternalPath = (pathname: string): boolean => PREFIX.test(pathname);
