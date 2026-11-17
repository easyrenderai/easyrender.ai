import { createTranslator } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import en from '@/messages/en.json';
import es from '@/messages/es.json';

vi.mock('next-intl/server', () => ({
  getTranslations: async ({
    locale,
    namespace,
  }: {
    locale: 'en' | 'es' | 'fr';
    namespace: 'Legal';
  }) => createTranslator({ locale, messages: locale === 'es' ? es : en, namespace }),
}));

import { LegalPage } from '@/components/legal-page';

it.each(['privacy', 'terms'] as const)(
  'renders the full Spanish %s text with its true language',
  async (kind) => {
    const html = renderToStaticMarkup(await LegalPage({ kind, locale: 'es' }));
    expect(html).toContain('lang="es"');
    expect(html).not.toContain('lang="en"');
    expect(html).not.toContain(es.Legal.languageNotice);
    expect(Object.keys(es.Legal[kind].sections)).toEqual(Object.keys(en.Legal[kind].sections));
    const translated = Object.values(es.Legal[kind].sections);
    for (const [index, section] of Object.values(en.Legal[kind].sections).entries()) {
      expect(translated[index].title).not.toBe(section.title);
      expect(translated[index].body).not.toBe(section.body);
      expect(translated[index].body.length).toBeGreaterThan(section.body.length * 0.75);
    }
  },
);
it('keeps English disclosure for an untranslated locale', async () => {
  const html = renderToStaticMarkup(await LegalPage({ kind: 'terms', locale: 'fr' }));
  expect(html).toContain('lang="en"');
  expect(html).toContain(en.Legal.languageNotice);
});
