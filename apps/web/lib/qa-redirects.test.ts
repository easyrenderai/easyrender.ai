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
