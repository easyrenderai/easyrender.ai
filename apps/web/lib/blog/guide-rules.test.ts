import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LOCALES } from '@/i18n/config';
import { faqPage } from '@/lib/seo/jsonld';
import { postMetadata } from '@/lib/seo/pages';
import {
  BLOG_IMAGES,
  ILLUSTRATION_DIR,
  isIllustration,
  MIN_SCHEMA_WIDTH,
  parseImage,
  schemaImage,
} from './images';
import { heroSource, Markdown, parseBlocks, sections } from './markdown';
import { type BlogPost, readPosts } from './posts';

// Stage 5 of the blog pipeline (docs/blog/PIPELINE.md): the rules every guide is built to, checked
// on every push so a guide that skips one cannot be merged. They apply to every English guide and
// to each translation once it carries its illustration, so translations written before these
// rules keep building until they are redone from the current English (see the pipeline's
// translation stage).

const guides: BlogPost[] = LOCALES.flatMap((locale) => readPosts(locale)).filter(
  (post) => post.locale === 'en' || post.body.includes(ILLUSTRATION_DIR),
);

// One creative (a picture, a 3D model, a diagram or a table) for every WORDS_PER_CREATIVE words of
// text, and never fewer than MIN_CREATIVES. The seven week 1 guides run at one per 200 to 330.
const WORDS_PER_CREATIVE = 400;
const MIN_CREATIVES = 5;
// Distinct outside sites a guide cites inline: official docs, specs or primary research.
const MIN_SOURCES = 3;

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** The prose of a body, without picture lines and table rows, for the creatives ratio. */
const textOnly = (body: string) =>
  body
    .split('\n')
    .filter((line) => !parseImage(line) && !/^\|/.test(line.trim()))
    .join('\n');

const decode = (html: string) =>
  html
    // A closing block tag is a space in the reading order. Stripping it with nothing joins
    // two FAQ paragraphs into one word, so a multi-paragraph answer never matches.
    .replace(/<\/(p|li|h[1-6]|blockquote|figcaption)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

describe.each(guides.map((post) => [`${post.locale}/${post.slug}`, post] as const))(
  'guide %s',
  (_, post) => {
    const blocks = parseBlocks(post.body);
    const hero = heroSource(blocks);

    it('opens with its own illustration directly under the first paragraph', () => {
      expect(blocks[0]?.kind).toBe('paragraph');
      expect(hero, 'the first block after the first paragraph is not one picture').toBeDefined();
      const src = hero as string;
      expect(isIllustration(src), src).toBe(true);
      // Named after the guide's group, so a translation shows the same file as its English guide.
      expect(src.startsWith(`${ILLUSTRATION_DIR}${post.group}/`), src).toBe(true);
      expect(BLOG_IMAGES[src], `${src} is not in BLOG_IMAGES`).toBeDefined();
      expect(BLOG_IMAGES[src]?.width).toBeGreaterThanOrEqual(MIN_SCHEMA_WIDTH);
    });

    it('uses that illustration as its BlogPosting and Open Graph image', () => {
      expect(schemaImage(post.body)?.src).toBe(hero);
      const images = postMetadata(post).openGraph?.images;
      const first = (Array.isArray(images) ? images[0] : images) as { url: string; width?: number };
      expect(String(first.url).endsWith(hero as string)).toBe(true);
      expect(first.width).toBe(BLOG_IMAGES[hero as string]?.width);
    });

    it('says in the caption of every illustration that it is one', () => {
      for (const line of post.body.split('\n')) {
        const image = parseImage(line);
        if (!image || !isIllustration(image.src)) continue;
        expect(image.caption, image.src).toBeTruthy();
        if (post.locale === 'en') expect(image.caption, image.src).toMatch(/\billustration\b/i);
      }
    });

    it('renders its FAQ as an accordion, with every answer in the server HTML', () => {
      const faq = sections(blocks).filter((section) => section.kind === 'faq');
      expect(faq).toHaveLength(1);

      const html = renderToStaticMarkup(createElement(Markdown, { source: post.body }));
      const items = html.match(/data-slot="accordion-item"/g) ?? [];
      const jsonLd = faqPage(post.faq).mainEntity as unknown[];
      expect(items.length).toBeGreaterThanOrEqual(3);
      expect(items.length).toBe(post.faq.length);
      expect(items.length).toBe(jsonLd.length);
      // Closed panels are mounted and hidden with CSS, not left out, so crawlers read every answer.
      const panels = html.match(/<div[^>]*data-slot="accordion-content"[^>]*>/g) ?? [];
      expect(panels).toHaveLength(items.length);
      for (const panel of panels) {
        expect(panel).toContain('data-state="closed"');
        expect(panel).toContain('data-[state=closed]:hidden');
      }
      expect(html).toContain('<noscript>');
      const text = decode(html);
      for (const item of post.faq) {
        expect(text, item.question).toContain(item.question);
        expect(text, item.question).toContain(item.answer);
      }
    });

    it('carries enough creatives for its length', () => {
      const media = post.body.split('\n').filter((line) => parseImage(line)?.size).length;
      const tables = parseBlocks(post.body).filter((block) => block.kind === 'table').length;
      const creatives = media + tables;
      const needed = Math.max(
        MIN_CREATIVES,
        Math.ceil(words(textOnly(post.body)) / WORDS_PER_CREATIVE),
      );
      expect(creatives).toBeGreaterThanOrEqual(needed);
      // The illustration sets the scene; at least one more creative has to explain something.
      const explanatory = post.body
        .split('\n')
        .map((line) => parseImage(line))
        .filter((image) => image?.size && !isIllustration(image.src));
      expect(explanatory.length).toBeGreaterThanOrEqual(1);
    });

    it('cites its outside facts inline, from at least three other sites', () => {
      const hosts = new Set(
        [...post.body.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)]
          .map(([, href]) => new URL(href as string).hostname.replace(/^www\./, ''))
          .filter((host) => !host.endsWith('easyrender.ai')),
      );
      expect(hosts.size, [...hosts].join(', ')).toBeGreaterThanOrEqual(MIN_SOURCES);
    });
  },
);

describe('the illustrations across the guides', () => {
  it('gives every English guide its own illustration, never shared', () => {
    const english = guides.filter((post) => post.locale === 'en');
    const heroes = english.map((post) => heroSource(parseBlocks(post.body)));
    expect(heroes.every(Boolean)).toBe(true);
    expect(new Set(heroes).size).toBe(english.length);
  });

  it('registers only illustrations that are drawn for a guide and used by one', () => {
    const used = new Set(
      guides.flatMap((post) =>
        post.body.split('\n').flatMap((line) => {
          const image = parseImage(line);
          return image && isIllustration(image.src) ? [image.src] : [];
        }),
      ),
    );
    const registered = Object.keys(BLOG_IMAGES).filter(isIllustration);
    expect(registered.filter((src) => !used.has(src))).toEqual([]);
  });
});
