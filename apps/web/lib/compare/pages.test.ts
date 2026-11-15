import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCALES } from '@/i18n/config';
import { BLOG_IMAGES, parseImage } from '@/lib/blog/images';
import { heroSource, parseBlocks } from '@/lib/blog/markdown';
import { llmsFullTxt, llmsTxt } from '@/lib/seo/llms';
import { isNoindexPath } from '@/lib/seo/noindex';
import { postTitle } from '@/lib/seo/pages';
import { ROUTES } from '@/lib/seo/routes';
import { localeSitemapXml } from '@/lib/seo/sitemap';
import {
  COMPARE_INDEX,
  compareHref,
  getComparePage,
  isCompareInReview,
  isComparePublished,
  listComparePages,
  readComparePages,
} from './pages';

// The published English comparisons: written to the same bar as the guides, now indexable.
// If one of these fails, either the copy broke a rule or a compare URL is missing from the
// sitemap, llms.txt or the places we chose to link it from.

const REVIEW_SLUGS = ['360-vs-3d', '3d-modeler-vs-ai', 'meshy', 'photogrammetry-software', 'tripo'];

const pages = readComparePages();
const ROOT = process.cwd();
const raw = (slug: string) =>
  readFileSync(join(ROOT, 'content', 'compare', 'en', `${slug}.md`), 'utf8');

/** Every file under a directory, recursively, with one of the given extensions. */
function filesUnder(dir: string, extensions: string[]): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...filesUnder(path, extensions));
    else if (extensions.some((extension) => name.endsWith(extension))) out.push(path);
  }
  return out;
}

describe('the published comparisons', () => {
  it('are the five English pages, plus an index', () => {
    expect(pages.map((page) => page.slug)).toEqual(REVIEW_SLUGS);
    expect(isComparePublished()).toBe(true);
    expect(isCompareInReview()).toBe(false);
    expect(listComparePages()).toHaveLength(5);
    expect(COMPARE_INDEX.en.title.length).toBeLessThanOrEqual(60);
    expect(postTitle(COMPARE_INDEX.en.title).length).toBeLessThanOrEqual(60);
    expect(COMPARE_INDEX.en.description.length).toBeLessThanOrEqual(160);
    for (const slug of REVIEW_SLUGS) expect(getComparePage(slug)?.path).toBe(`/compare/${slug}`);
    expect(compareHref('es', 'meshy')).toBe('/es/comparativas/meshy');
    expect(compareHref('de', 'vergleich-meshy')).toBe('/de/vergleich/vergleich-meshy');
    expect(compareHref('fr', 'javascript:alert(1)')).toBe('/fr/comparatifs');
    expect(compareHref('it', '../file-glb')).toBe('/it/confronti');
    expect(getComparePage('does-not-exist')).toBeNull();
  });
});

describe.each(pages.map((page) => [page.slug, page] as const))('compare page %s', (slug, page) => {
  it('fits a search result and records its keyword and last change', () => {
    expect(page.title.length).toBeLessThanOrEqual(60);
    expect(postTitle(page.title).length).toBeLessThanOrEqual(60);
    expect(page.description.length).toBeLessThanOrEqual(160);
    expect(page.keyword).toBeTruthy();
    expect(page.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('ends with an FAQ accordion of 3 to 6 questions', () => {
    expect(page.faq.length).toBeGreaterThanOrEqual(3);
    expect(page.faq.length).toBeLessThanOrEqual(6);
  });

  it('opens with its own illustration directly under the first paragraph', () => {
    const blocks = parseBlocks(page.body);
    expect(blocks[0]?.kind).toBe('paragraph');
    const hero = heroSource(blocks);
    const src = `/compare/illustrations/${slug}/hero.webp`;
    expect(hero).toBe(src);
    expect(BLOG_IMAGES[src]).toEqual({ width: 1280, height: 720 });
    expect(
      statSync(join(ROOT, 'public', 'compare', 'illustrations', slug, 'hero.webp')).isFile(),
    ).toBe(true);

    const image = page.body
      .split('\n')
      .map(parseImage)
      .find((item) => item?.src === src);
    expect(image?.alt).toMatch(/^Illustration of /);
    expect(image?.caption).toMatch(/^Illustration, not an easyrender result:/);
    expect(raw(slug)).not.toMatch(/ILLUSTRATION PENDING/);
  });

  it('types no easyrender price and leaves no token unfilled', () => {
    expect(page.body).not.toMatch(/\{\{\w+\}\}/);
    // Competitor prices are quoted from their pages; ours only ever come from the harness.
    for (const sentence of raw(slug).split(/(?<=[.?!])\s+/)) {
      if (/easyrender/i.test(sentence) && /\d+\s*credits?\b/i.test(sentence)) {
        expect(sentence, sentence).toMatch(/\{\{\w+\}\}/);
      }
    }
  });

  it('follows the tone guide: no em dashes, exclamations or stock AI phrases', () => {
    const text = `${page.title}\n${page.description}\n${page.body}`;
    expect(text).not.toMatch(/—/);
    expect(page.body.replace(/`[^`]*`/g, '')).not.toMatch(/!(?!\[)/);
    expect(text).not.toMatch(
      /\b(delve|unlock|elevate|leverage|landscape|seamless(ly)?|game-changer|tapestry|revolutioni[sz]e|cutting-edge|crucial|robust|in today's|in summary|ultimately|it's not just)\b/i,
    );
  });

  it('respects claims.md: no real-world scale, no 3D printing offer, no embed promise', () => {
    const text = page.body.toLowerCase();
    expect(text).not.toMatch(
      /\b(to scale|true-to-size|true to size|real-world size|will it fit\?)/,
    );
    for (const sentence of text.split(/(?<=[.?!])\s+/)) {
      if (sentence.includes('easyrender') && /\b(stl|3d print|embed)/.test(sentence)) {
        expect(sentence).toMatch(/\bnot\b|\bno\b/);
      }
    }
  });

  it('cites its outside facts with links to the pages they come from', () => {
    // An alternative page cites mostly the competitor's own docs and pricing, so this counts
    // distinct pages, not distinct sites.
    const external = new Set(
      [...page.body.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => m[1] as string),
    );
    expect(external.size).toBeGreaterThanOrEqual(3);
  });
});

describe('once they are published', () => {
  it('are indexable at the hub and at every slug', () => {
    expect(isNoindexPath('/compare')).toBe(false);
    for (const page of pages) expect(isNoindexPath(page.path), page.path).toBe(false);
  });

  it('appear in every language’s sitemap, with hreflang only where that file exists', () => {
    const english = [localeSitemapXml('en'), llmsTxt(), llmsFullTxt()].join('\n');
    expect(english).toContain('/compare<');
    expect(english).toMatch(/https:\/\/easyrender\.ai\/compare['"\s<]/);
    for (const page of pages) {
      expect(english, page.path).toContain(page.path);
    }
    for (const locale of LOCALES.filter((item) => item !== 'en')) {
      const xml = localeSitemapXml(locale);
      expect(xml, locale).toContain(
        `<loc>https://easyrender.ai${ROUTES.compare.paths[locale]}</loc>`,
      );
      // The English hub is an alternate of the localized hub, not a second canonical.
      expect(xml, locale).toContain('hreflang="en" href="https://easyrender.ai/compare"');
    }
  });

  it('are linked from the English guides hub and from related guides, not from chrome', () => {
    const hub = readFileSync(join(ROOT, 'components', 'blog', 'blog-index-view.tsx'), 'utf8');
    expect(hub).toMatch(/listComparePages/);
    const guides = filesUnder(join(ROOT, 'content', 'blog', 'en'), ['.md'])
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    expect(guides).toMatch(/\]\(\/compare\//);

    const chrome = [
      ...filesUnder(join(ROOT, 'app'), ['.ts', '.tsx']),
      ...filesUnder(join(ROOT, 'components'), ['.ts', '.tsx']),
      ...filesUnder(join(ROOT, 'messages'), ['.json']),
    ].filter(
      (file) =>
        !file.includes(`${join('app', '(marketing)', 'compare')}`) &&
        !file.includes(`${join('components', 'compare')}`) &&
        !file.includes(`${join('components', 'blog', 'blog-index-view')}`),
    );
    for (const file of chrome) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/["'(`]\/compare\b/);
    }
  });
});
