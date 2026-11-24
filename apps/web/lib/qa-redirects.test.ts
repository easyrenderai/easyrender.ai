import {
  getRedirectUrl,
  unstable_getResponseFromNextConfig,
} from 'next/experimental/testing/server';
import { describe, expect, it } from 'vitest';
import { ROUTABLE_LOCALES } from '@/i18n/config';
import config from '../next.config';
import { ROUTES } from './seo/routes';

describe('permanent QA aliases', () => {
  it('redirects both auth aliases at the root and for every supported locale', async () => {
    const redirects = (await config.redirects?.()) ?? [];
    for (const locale of ['', ...ROUTABLE_LOCALES]) {
      const prefix = locale ? `/${locale}` : '';
      const targetPrefix = locale === 'en' ? '' : prefix;
      for (const [alias, target] of [
        ['login', 'sign-in'],
        ['signup', 'sign-up'],
      ]) {
        expect(redirects).toContainEqual({
          source: `${prefix}/${alias}`,
          destination: `${targetPrefix}/${target}`,
          permanent: true,
        });
      }
    }
  });

  it('uses the guide registry without redirecting canonical routes', async () => {
    const redirects = (await config.redirects?.()) ?? [];
    for (const locale of ROUTABLE_LOCALES) {
      expect(redirects).toContainEqual({
        source: `/${locale}/learn`,
        destination: ROUTES.blog.paths[locale],
        permanent: true,
      });
      expect(redirects.some(({ source }) => source === ROUTES.blog.paths[locale])).toBe(false);
    }
  });
});

it.each([
  '/login',
  '/signup',
  '/es/login',
  '/fr/signup',
  '/es/learn',
  '/de/learn',
  '/en/learn/example',
])('preserves attribution on configured redirect %s', async (path) => {
  const query =
    'utm_source=google&utm_medium=cpc&utm_campaign=niche&utm_content=ad&utm_term=model&gclid=Ad_1&gbraid=Ad_2&wbraid=Ad_3';
  const response = await unstable_getResponseFromNextConfig({
    url: `https://easyrender.ai${path}?${query}`,
    nextConfig: config,
  });
  expect(response.status).toBe(308);
  expect(new URL(getRedirectUrl(response) ?? '').search).toBe(`?${query}`);
});
