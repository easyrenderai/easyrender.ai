import { expect, it } from 'vitest';
import { LOCALES } from '@/i18n/config';
import { isPricedPage, PRICED_ROUTE_KEYS } from '@/lib/priced-pages';
import { isPricedInternalPath, pricedPath, publicPath } from '@/lib/priced-route';
import { ROUTE_KEYS, ROUTES } from '@/lib/seo/routes';

it('names every page that quotes money, in every language, and nothing else', () => {
  for (const key of PRICED_ROUTE_KEYS)
    for (const locale of LOCALES) expect(isPricedPage(ROUTES[key].paths[locale])).toBe(true);
  const other = ROUTE_KEYS.filter((key) => !(PRICED_ROUTE_KEYS as readonly string[]).includes(key));
  for (const key of other)
    for (const locale of LOCALES) {
      const path = ROUTES[key].paths[locale];
      const isQuoted = PRICED_ROUTE_KEYS.some((priced) =>
        LOCALES.some((l) => ROUTES[priced].paths[l] === path),
      );
      expect(isPricedPage(path), path).toBe(isQuoted);
    }
  expect(isPricedPage('/pricing/')).toBe(true);
  expect(isPricedPage('/mcp')).toBe(false);
  expect(isPricedPage('/learn/some-guide')).toBe(false);
  expect(isPricedPage('/dashboard')).toBe(false);
});

it('turns a public path into the page built for a key, and back', () => {
  expect(pricedPath('eur.test', '/')).toBe('/p/eur.test');
  expect(pricedPath('usd.control', '/de/preise')).toBe('/p/usd.control/de/preise');
  expect(publicPath('/p/eur.test')).toBe('/');
  expect(publicPath('/p/usd.control/de/preise')).toBe('/de/preise');
  expect(publicPath('/pricing')).toBe('/pricing');
  expect(publicPath('/p/gbp.control/pricing')).toBe('/p/gbp.control/pricing');
  expect(isPricedInternalPath('/p/eur.control/pricing')).toBe(true);
  expect(isPricedInternalPath('/pricing')).toBe(false);
});
