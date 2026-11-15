import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DIAGRAMS } from '@/components/blog/diagrams';
import { LOCALES } from '@/i18n/config';
import { postTitle } from '@/lib/seo/pages';
import { BLOG_DIAGRAMS, parseImage } from './images';
import { readPosts } from './posts';

// The English guides, checked against the rules they are written to: the SEO limits, the tone
// guide (decisiones/tono-de-voz.md, section 5b) and decisiones/claims.md. A guide that breaks one
// fails here, before review, rather than after it is live.

const posts = readPosts('en');
const CORE_GUIDE = '/learn/how-to-make-a-3d-model';

const raw = (slug: string) =>
  readFileSync(join(process.cwd(), 'content', 'blog', 'en', `${slug}.md`), 'utf8');

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** Prose paragraphs of a body: not headings, lists, quotes, images, tables or rules. */
const paragraphs = (body: string) =>
  body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block && !/^(#{2,4}\s|[-*]\s|\d+[.)]\s|>|!\[|\||-{3,})/.test(block));

describe.each(posts.map((post) => [post.slug, post] as const))('guide %s', (slug, post) => {
  it('fits a search result: title and <title> at most 60 characters, description at most 155', () => {
    expect(post.title.length).toBeLessThanOrEqual(60);
    expect(postTitle(post.title).length).toBeLessThanOrEqual(60);
    expect(post.description.length).toBeLessThanOrEqual(155);
  });

  it('records its target keyword and the date of the last change', () => {
    expect(post.keyword).toBeTruthy();
    expect(post.updated).toBeTruthy();
  });

  it('opens with a direct answer of 40 to 60 words', () => {
    const first = paragraphs(post.body)[0] as string;
    expect(words(first)).toBeGreaterThanOrEqual(40);
    expect(words(first)).toBeLessThanOrEqual(60);
  });

  it('keeps every paragraph to three sentences and 60 words', () => {
    for (const paragraph of paragraphs(post.body)) {
      expect(words(paragraph), paragraph).toBeLessThanOrEqual(60);
      const sentences = paragraph.split(/(?<=[.?!])\s+(?=[A-Z0-9"“])/).length;
      expect(sentences, paragraph).toBeLessThanOrEqual(3);
    }
  });

  it('ends with an FAQ of 3 to 5 questions, each answered in 40 to 60 words', () => {
    expect(post.faq.length).toBeGreaterThanOrEqual(3);
    expect(post.faq.length).toBeLessThanOrEqual(5);
    for (const item of post.faq) {
      expect(item.question.endsWith('?'), item.question).toBe(true);
      expect(words(item.answer), item.question).toBeGreaterThanOrEqual(40);
      expect(words(item.answer), item.question).toBeLessThanOrEqual(60);
    }
  });

  it('links to the core guide, and to the home at most once in the text', () => {
    if (post.path !== CORE_GUIDE) expect(post.body).toContain(`](${CORE_GUIDE})`);
    // The closing button is the end call to action; the text may hold one more, mid-post.
    expect(post.body.match(/\]\(\/(#[\w-]+)?\)/g)?.length ?? 0).toBeLessThanOrEqual(1);
    expect(post.cta).toBeTruthy();
  });

  it('only links to guides that exist', () => {
    const slugs = new Set(posts.map((entry) => entry.path));
    for (const [, href] of post.body.matchAll(/\]\((\/learn\/[^)#\s]+)/g)) {
      expect(slugs.has(href as string), href).toBe(true);
    }
  });

  it('only shows real images, with their size known', () => {
    for (const line of post.body.split('\n')) {
      const image = parseImage(line);
      if (image) {
        expect(image.size, image.src).not.toBeNull();
        expect(image.alt.length).toBeGreaterThan(10);
      }
    }
  });

  it('shows at least one real picture or 3D model, each with its alt text and a caption', () => {
    // Tone guide 5c: every guide carries a creative that explains something. A table alone does
    // not count, and a missing asset is an IMAGE PENDING note, never a stand-in picture.
    const media = post.body.split('\n').flatMap((line) => {
      const image = parseImage(line);
      return image?.size ? [image] : [];
    });
    expect(media.length).toBeGreaterThan(0);
    for (const item of media) expect(item.caption, item.src).toBeTruthy();
  });

  it('shows each picture, model and diagram once', () => {
    const sources = post.body.split('\n').flatMap((line) => {
      const media = parseImage(line);
      return media ? [media.src] : [];
    });
    expect(new Set(sources).size, sources.join('\n')).toBe(sources.length);
  });

  it('only draws diagrams that exist, with words in the guide’s language', () => {
    for (const line of post.body.split('\n')) {
      const media = parseImage(line);
      if (!media?.diagram) continue;
      const diagram = DIAGRAMS[media.diagram];
      expect(diagram, media.src).toBeDefined();
      expect(diagram?.locales, media.src).toContain(post.locale);
    }
  });

  it('has no typed price, no unfilled token and no plan that does not exist', () => {
    const source = raw(slug);
    expect(post.body).not.toMatch(/\{\{\w+\}\}/);
    expect(source).not.toMatch(/\$\s?\d|\d\s?\$|US\$/);
    expect(source).not.toMatch(/\bStarter\b/);
  });

  it('follows the tone guide: no em dashes, exclamations or stock AI phrases', () => {
    const text = `${post.title}\n${post.description}\n${post.body}`;
    expect(text).not.toMatch(/—/);
    expect(post.body.replace(/`[^`]*`/g, '')).not.toMatch(/!(?!\[)/);
    expect(text).not.toMatch(
      /\b(delve|unlock|elevate|leverage|landscape|seamless(ly)?|game-changer|tapestry|revolutioni[sz]e|cutting-edge|crucial|robust|in today's|in summary|ultimately|it's not just)\b/i,
    );
  });

  it('respects claims.md: no real-world scale, no 3D printing offer, no embed promise', () => {
    const text = post.body.toLowerCase();
    expect(text).not.toMatch(/\b(to scale|true-to-size|will it fit\?)/);
    // A sentence about easyrender may only mention STL, printing or embedding to rule it out.
    for (const sentence of text.split(/(?<=[.?!])\s+/)) {
      if (sentence.includes('easyrender') && /\b(stl|3d print|embed)/.test(sentence)) {
        expect(sentence).toMatch(/\bnot\b/);
      }
    }
  });
});

describe('across the guides', () => {
  it('puts each picture, 3D model and diagram in one guide only', () => {
    // No creative repeats across guides: not a photo, an angle sheet, a crop, a GLB or a diagram.
    // A second use of the same object needs its own file, a crop with an honest caption.
    const guidesBySrc = new Map<string, Set<string>>();
    for (const entry of posts) {
      for (const line of entry.body.split('\n')) {
        const media = parseImage(line);
        if (media)
          guidesBySrc.set(media.src, (guidesBySrc.get(media.src) ?? new Set()).add(entry.slug));
      }
    }
    const shared = [...guidesBySrc]
      .filter(([, guides]) => guides.size > 1)
      .map(([src, guides]) => `${src}: ${[...guides].sort().join(', ')}`);
    expect(shared).toEqual([]);
  });
});

describe('diagrams in every language', () => {
  const translated = LOCALES.flatMap((locale) => readPosts(locale));

  it('draws each diagram with words in the guide’s language', () => {
    for (const post of translated) {
      for (const line of post.body.split('\n')) {
        const media = parseImage(line);
        if (!media?.diagram) continue;
        const diagram = DIAGRAMS[media.diagram];
        expect(diagram, `${post.locale}/${media.src}`).toBeDefined();
        expect(diagram?.locales, `${post.locale}/${media.src}`).toContain(post.locale);
      }
    }
  });
});

describe('the diagram registry', () => {
  it('lists the same diagrams in images.ts and components/blog/diagrams', () => {
    expect([...BLOG_DIAGRAMS].sort()).toEqual(Object.keys(DIAGRAMS).sort());
  });

  it('treats an unknown diagram like an unknown image: no size, so it shows as text', () => {
    expect(parseImage('![A diagram that was never drawn](diagram:nope "x")')?.size).toBeNull();
    expect(parseImage('![The GLB anatomy](diagram:glb-anatomy "x")')?.diagram).toBe('glb-anatomy');
  });
});
