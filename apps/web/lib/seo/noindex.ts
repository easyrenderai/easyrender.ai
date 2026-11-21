// The pages that must stay out of the index, in one list, because it is enforced in three
// places: a meta tag on the page, an x-robots-tag header from next.config.ts, and an assertion
// that the sitemaps never list any of them. No imports, so next.config.ts can read it too.
//
//  - /explore, /hub and /r/* are the gallery, the element hub and the model pages: product
//    surfaces that grow on their own, parked until decision 2's three conditions are met.
//  - /try is the test flow behind the home's button: the upload, then a sign-up for the result.
//  - /lp/* are ad landings. They are noindex but deliberately crawlable, because AdsBot has to
//    fetch them, which is why none of this is done with a Disallow.
//  - /sign-in, /sign-up and /oauth are auth.
//  - /ar/* is the phone page behind a store's QR code, /shopify/* the Shopify app's own pages.

export const NOINDEX_PREFIXES = [
  '/admin',
  '/explore',
  '/hub',
  '/r/',
  '/try',
  '/lp/',
  '/sign-in',
  '/sign-up',
  '/oauth',
  '/ar/',
  '/shopify',
] as const;

/** The same set as next.config.ts route patterns, for the response header. */
export const NOINDEX_HEADER_PATHS = [
  '/explore',
  '/hub',
  '/r/:id',
  '/try',
  '/lp/:path*',
  '/ar/:id',
  '/shopify/:path*',
];

/** True when a path must carry noindex. */
export const isNoindexPath = (path: string): boolean =>
  NOINDEX_PREFIXES.some((prefix) =>
    prefix.endsWith('/')
      ? path.startsWith(prefix)
      : path === prefix || path.startsWith(`${prefix}/`),
  );
