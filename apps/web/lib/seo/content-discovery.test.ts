import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCALES } from '@/i18n/config';
import { readPosts } from '@/lib/blog/posts';
import { readComparePages } from '@/lib/compare/pages';
import { organization } from './jsonld';
import { resourceLinks } from './resources';
import { ROUTES } from './routes';

describe('published editorial navigation', () => {
  it('takes visitors from the MCP landing to the API, comparison hub and published guides', () => {
    const links = resourceLinks('en', 'mcp', new Date('2026-11-30'));
    expect(links.routes.map((item) => item.href)).toEqual([
      '/image-to-3d-api',
      '/compare',
      '/pricing',
    ]);
    expect(links.guides.map((item) => item.href)).toContain('/learn/glb-file');
  });
  it('never promotes scheduled guides or unavailable localized integrations', () => {
    expect(resourceLinks('en', 'home', new Date('2026-11-01')).guides).toEqual([]);
    expect(resourceLinks('de', 'article').routes.map((item) => item.href)).toEqual(['/de/preise']);
  });
  it('links named authors to a real profile instead of the home page', () => {
    for (const locale of LOCALES) {
      const posts = readPosts(locale).filter((post) => post.author.name === 'Jorge Rodríguez');
      for (const post of posts) {
        expect(post.author.url, post.path).toContain('jorge-rodriguez');
      }
    }
  });

  it('identifies the organization with its published logo and official repository', () => {
    expect(organization()).toMatchObject({
      logo: 'https://easyrender.ai/icon.svg',
      sameAs: expect.arrayContaining(['https://github.com/easyrenderai']),
    });
  });
  it('every comparison link resolves to a real localized comparison', () => {
    const comparisons = LOCALES.flatMap((locale) => readComparePages(locale));
    const paths = new Set(comparisons.map((page) => page.path));
    const prefixes = Object.values(ROUTES.compare.paths).map((path) => `${path}/`);
    const errors: string[] = [];
    for (const page of [...comparisons, ...LOCALES.flatMap((locale) => readPosts(locale))]) {
      for (const match of page.body.matchAll(/\]\((\/[^)\s]+)\)/g)) {
        const href = (match[1] as string).split(/[?#]/)[0] as string;
        if (prefixes.some((prefix) => href.startsWith(prefix)) && !paths.has(href)) {
          errors.push(`${page.path} -> ${href}`);
        }
      }
    }
    expect(errors).toEqual([]);
  });

  it.each(['de', 'fr', 'it', 'pt'])('%s guide chrome does not fall back to English', (locale) => {
    const messages = JSON.parse(
      readFileSync(join(process.cwd(), 'messages', `${locale}.json`), 'utf8'),
    );
    const english = JSON.parse(readFileSync(join(process.cwd(), 'messages', 'en.json'), 'utf8'));
    for (const key of ['metaTitle', 'metaDescription', 'description', 'empty', 'readMore']) {
      expect(messages.Blog.index[key], `${locale}: ${key}`).not.toBe(english.Blog.index[key]);
    }
    for (const key of ['published', 'updated', 'backToIndex']) {
      expect(messages.Blog.post[key], `${locale}: ${key}`).not.toBe(english.Blog.post[key]);
    }
    expect(messages.Blog.post.cta).not.toEqual(english.Blog.post.cta);
  });
});
