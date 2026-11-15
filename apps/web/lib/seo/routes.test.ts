import { describe, expect, it } from 'vitest';
import { HREFLANG, LOCALES, ROUTABLE_LOCALES } from '@/i18n/config';
import { isNoindexPath, NOINDEX_HEADER_PATHS } from './noindex';
import {
  hreflangFor,
  isInReview,
  isPublished,
  livePaths,
  ROUTE_KEYS,
  ROUTES,
  type RouteEntry,
} from './routes';
import { absoluteUrl, SITE_URL } from './site';

describe('the route registry', () => {
  it('gives every page a path in all six languages', () => {
    for (const key of ROUTE_KEYS) {
      for (const locale of LOCALES) {
        expect(ROUTES[key].paths[locale], `${key}/${locale}`).toMatch(/^\//);
      }
    }
  });

  it('prefixes every non-English path with its language', () => {
    for (const key of ROUTE_KEYS) {
      for (const locale of LOCALES) {
        if (locale === 'en') continue;
        expect(ROUTES[key].paths[locale], `${key}/${locale}`).toMatch(
          new RegExp(`^/${locale}(/|$)`),
        );
      }
    }
  });

  it('never reuses a path between two pages of the same language', () => {
    for (const locale of LOCALES) {
      const paths = ROUTE_KEYS.map((key) => ROUTES[key].paths[locale]);
      expect(new Set(paths).size, locale).toBe(paths.length);
    }
  });

  it('only publishes a language whose UI strings exist', () => {
    for (const key of ROUTE_KEYS) {
      for (const locale of ROUTES[key].published) {
        expect(ROUTABLE_LOCALES, `${key}/${locale}`).toContain(locale);
      }
    }
  });

  it('opens the models and evals pages in English and Spanish only', () => {
    for (const key of ['models', 'evals'] as const) {
      expect(livePaths(key), key).toEqual({
        en: ROUTES[key].paths.en,
        es: ROUTES[key].paths.es,
      });
    }
    expect(livePaths('models')).toEqual({ en: '/models', es: '/es/modelos' });
    expect(livePaths('evals')).toEqual({ en: '/evals', es: '/es/evaluaciones' });
  });

  it('opens the six homes and cookie information in de, fr, it and pt', () => {
    expect(livePaths('home')).toEqual({
      en: '/',
      es: '/es',
      de: '/de',
      fr: '/fr',
      it: '/it',
      pt: '/pt',
    });
    // Homes, legal pages, guides and comparisons are live. Other marketing pages still
    // wait for reviewed copy.
    for (const locale of ['de', 'fr', 'it', 'pt'] as const) {
      for (const key of ROUTE_KEYS) {
        if (
          ['home', 'cookies', 'privacy', 'terms', 'pricing', 'blog', 'compare', 'author'].includes(
            key,
          )
        )
          continue;
        expect(isPublished(key, locale), `${key}/${locale}`).toBe(false);
      }
    }
  });

  it('hides the path of an unpublished language', () => {
    expect(livePaths('blog')).toEqual(ROUTES.blog.paths);
    expect(isPublished('compare', 'en')).toBe(true);
    expect(livePaths('compare')).toEqual(ROUTES.compare.paths);
    // Pricing is now open in every supported locale.
    expect(livePaths('pricing')).toEqual(ROUTES.pricing.paths);
  });
});

describe('hreflang', () => {
  it('lists every tag of every live language plus x-default', () => {
    const alternates = hreflangFor(livePaths('home'));
    expect(alternates).toEqual({
      en: SITE_URL,
      es: `${SITE_URL}/es`,
      'es-ES': `${SITE_URL}/es`,
      de: `${SITE_URL}/de`,
      'de-DE': `${SITE_URL}/de`,
      'de-AT': `${SITE_URL}/de`,
      'de-CH': `${SITE_URL}/de`,
      fr: `${SITE_URL}/fr`,
      'fr-FR': `${SITE_URL}/fr`,
      it: `${SITE_URL}/it`,
      'it-IT': `${SITE_URL}/it`,
      pt: `${SITE_URL}/pt`,
      'pt-PT': `${SITE_URL}/pt`,
      'x-default': SITE_URL,
    });
    // Never an /en URL: English lives at the root.
    expect(Object.values(alternates ?? {}).some((href) => href.includes('/en'))).toBe(false);
  });

  it('points x-default at the English page', () => {
    const alternates = hreflangFor({ en: '/learn', es: '/es/guias' });
    expect(alternates?.['x-default']).toBe(absoluteUrl('/learn'));
  });

  it('is dropped when there is nothing to point at', () => {
    expect(hreflangFor({ en: '/compare' })).toBeUndefined();
    expect(hreflangFor({})).toBeUndefined();
  });

  it('only ever emits absolute canonical-host URLs', () => {
    for (const href of Object.values(hreflangFor(livePaths('home')) ?? {})) {
      expect(href.startsWith(`${SITE_URL}`)).toBe(true);
    }
  });

  it('never offers pt-BR', () => {
    expect(Object.values(HREFLANG).flat()).not.toContain('pt-BR');
    expect(HREFLANG.pt).toEqual(['pt', 'pt-PT']);
  });
});

describe('noindex paths', () => {
  it('covers the product surfaces and the ad landings', () => {
    for (const path of [
      '/explore',
      '/explore/chairs',
      '/hub',
      '/r/demo-armchair',
      '/lp/en/ecommerce',
      '/sign-in',
    ]) {
      expect(isNoindexPath(path), path).toBe(true);
    }
  });

  it('leaves the indexable tree alone', () => {
    for (const path of [
      '/',
      '/es',
      '/learn',
      '/learn/glb-vs-usdz',
      '/credits',
      '/compare',
      '/compare/meshy',
    ]) {
      expect(isNoindexPath(path), path).toBe(false);
    }
  });

  it('keeps every noindex path out of the registry, except a page open for review', () => {
    for (const key of ROUTE_KEYS) {
      for (const locale of LOCALES) {
        // A review locale is the one deliberate exception: it is served noindex on purpose.
        if (isInReview(key, locale)) continue;
        expect(isNoindexPath(ROUTES[key].paths[locale]), `${key}/${locale}`).toBe(false);
      }
    }
  });
});

describe('pages open for review only', () => {
  it('are none, now that the English comparisons are published', () => {
    const inReview = ROUTE_KEYS.flatMap((key) =>
      LOCALES.filter((locale) => isInReview(key, locale)).map((locale) => `${key}/${locale}`),
    );
    expect(inReview).toEqual([]);
  });

  it('are never published at the same time, so nothing lists them', () => {
    for (const key of ROUTE_KEYS) {
      for (const locale of (ROUTES[key] as RouteEntry).review ?? []) {
        expect(isPublished(key, locale), `${key}/${locale}`).toBe(false);
        expect(livePaths(key)[locale], `${key}/${locale}`).toBeUndefined();
      }
    }
  });

  it('would carry noindex on the review path if any were open', () => {
    for (const key of ROUTE_KEYS) {
      for (const locale of (ROUTES[key] as RouteEntry).review ?? []) {
        const path = ROUTES[key].paths[locale];
        expect(isNoindexPath(path), path).toBe(true);
        expect(isNoindexPath(`${path}/meshy`), path).toBe(true);
      }
    }
    expect(NOINDEX_HEADER_PATHS).not.toEqual(
      expect.arrayContaining(['/compare', '/compare/:path*']),
    );
  });
});
