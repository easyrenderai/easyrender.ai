import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ArticlePromo } from '@/components/blog/article-promo';
import { ComparisonChoices } from '@/components/compare/comparison-choices';
import { LOCALES } from '@/i18n/config';
import { readComparePages } from '@/lib/compare/pages';
import { parseBlocks } from './markdown';

describe.each(LOCALES)('editorial decisions in %s', (locale) => {
  it('offers a localized preview with real input and output imagery', async () => {
    const messages = (await import(`../../messages/${locale}.json`)).default;
    const html = renderToStaticMarkup(
      createElement(ArticlePromo, { locale, copy: messages.Blog.post.promo }),
    );
    expect(html).toContain(locale === 'en' ? 'href="/#try"' : `href="/${locale}#try"`);
    expect(html).toContain('armchair.jpg');
    expect(html).toContain('armchair-angles.jpg');
    expect(html).toContain(messages.Blog.post.promo.disclosure);
    expect(html).not.toContain('<video');
  });
  it('makes choices and limitations readable without interaction', async () => {
    const messages = (await import(`../../messages/${locale}.json`)).default;
    const html = renderToStaticMarkup(
      createElement(ComparisonChoices, { copy: messages.Blog.comparisons.choices }),
    );
    expect(html.match(/<li/g)).toHaveLength(3);
    expect(html).toContain('easyrender');
    expect(html).toContain('Rodin');
    expect(html).toContain('Sloyd');
  });
  it('gives alternative articles selective emphasis and a decision takeaway', () => {
    const pages = readComparePages(locale).filter((p) =>
      ['compare-meshy', 'compare-tripo'].includes(p.group),
    );
    for (const page of pages) {
      expect(parseBlocks(page.body).filter((b) => b.kind === 'quote').length).toBeGreaterThan(0);
      expect((page.body.match(/\*\*[^*]+\*\*/g) ?? []).length).toBeGreaterThanOrEqual(5);
    }
  });
});
