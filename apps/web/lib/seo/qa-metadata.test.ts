import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { LOCALES } from '@/i18n/config';
import de from '@/messages/de.json';
import en from '@/messages/en.json';
import es from '@/messages/es.json';
import fr from '@/messages/fr.json';
import itMessages from '@/messages/it.json';
import pt from '@/messages/pt.json';
import { pageMetadata } from './metadata';
import * as pages from './pages';

const catalogs = { en, es, fr, de, it: itMessages, pt };
vi.mock('next-intl/server', () => ({
  getTranslations: async ({
    locale,
    namespace,
  }: {
    locale: keyof typeof catalogs;
    namespace: 'EcommerceLanding.meta';
  }) => createTranslator({ locale, messages: catalogs[locale], namespace }),
}));
describe('QA title follow-up', () => {
  it.each(LOCALES)('keeps %s ecommerce titles short and branded', async (locale) => {
    const metadata = await pages.ecommerceMetadata(locale);
    expect(String(metadata.title).length).toBeLessThanOrEqual(60);
    expect(metadata.title).toContain('Easy Render');
  });
  it('normalizes the brand suffix without changing pricing catalog content', () => {
    const metadata = pageMetadata({
      locale: 'en',
      path: '/pricing',
      title: en.Pricing.metaTitle,
      description: 'unchanged',
    });
    expect(metadata.title).toBe(en.Pricing.metaTitle.replace('easyrender', 'Easy Render'));
    expect(metadata.openGraph).toMatchObject({ title: metadata.title, siteName: 'Easy Render' });
  });
});
