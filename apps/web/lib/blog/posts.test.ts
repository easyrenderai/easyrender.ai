import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CREDIT_USD, PRO_PLAN, RENDER_CREDITS } from '@easyrender/harness';
import { describe, expect, it } from 'vitest';
import { parseFrontMatter } from './frontmatter';
import {
  faqFromBody,
  getPost,
  isLiveBlogLink,
  isPublishedPost,
  listPosts,
  modifiedDate,
  parsePost,
  postPath,
  readingMinutes,
  readPosts,
  relatedPosts,
} from './posts';

const post = (fields: Record<string, string>, body = 'A paragraph.') =>
  [
    '---',
    ...Object.entries(fields).map(([key, value]) => `${key}: ${value}`),
    '---',
    '',
    body,
  ].join('\n');

const VALID = {
  group: 'glb-vs-usdz',
  title: 'GLB or USDZ?',
  description: 'Which file you need.',
  date: '2026-11-23',
};

describe('front matter', () => {
  it('reads scalars and keeps the body', () => {
    const { data, body } = parseFrontMatter(post(VALID, 'Line one.\n\nLine two.'));
    expect(data).toEqual(VALID);
    expect(body).toBe('Line one.\n\nLine two.');
  });

  it('strips quotes, so a title with a colon can be written', () => {
    const { data } = parseFrontMatter(post({ ...VALID, title: '"GLB or USDZ: pick one"' }));
    expect(data.title).toBe('GLB or USDZ: pick one');
  });

  it('treats a file with no front matter as all body', () => {
    expect(parseFrontMatter('Just text.')).toEqual({ data: {}, body: 'Just text.' });
  });
});

describe('parsing a post', () => {
  it('normalises a date-only publication date to an instant', () => {
    const result = parsePost('en', 'glb-vs-usdz', post(VALID));
    expect(result).toMatchObject({
      post: { date: '2026-11-23T00:00:00.000Z', group: 'glb-vs-usdz', path: '/learn/glb-vs-usdz' },
    });
  });

  // Jorge, 11-nov-2026: new posts go live at 00:00 UTC, not midnight in Europe/Madrid.
  it('publishes a date-only value at 00:00 UTC, not at local midnight', () => {
    const result = parsePost('en', 'glb-vs-usdz', post(VALID));
    if ('error' in result) throw new Error(result.error);
    expect(result.post.date).toBe('2026-11-23T00:00:00.000Z');
  });

  it('refuses a file that is missing a required field, naming it', () => {
    const { group, ...withoutGroup } = VALID;
    expect(group).toBeDefined();
    expect(parsePost('en', 'x', post(withoutGroup))).toEqual({ error: 'missing group' });
    expect(parsePost('en', 'x', post(VALID, ''))).toEqual({ error: 'empty body' });
    expect(parsePost('en', 'x', post({ ...VALID, date: 'soon' }))).toEqual({
      error: 'invalid date "soon"',
    });
  });

  it('builds the native path of each language', () => {
    expect(postPath('en', 'glb-vs-usdz')).toBe('/learn/glb-vs-usdz');
    expect(postPath('es', 'glb-vs-usdz')).toBe('/es/guias/glb-vs-usdz');
    expect(postPath('de', 'glb-vs-usdz')).toBe('/de/ratgeber/glb-vs-usdz');
  });
});

describe('what a post carries besides its text', () => {
  const parsed = (fields: Record<string, string>, body?: string) => {
    const result = parsePost('en', 'glb-vs-usdz', post({ ...VALID, ...fields }, body));
    if ('error' in result) throw new Error(result.error);
    return result.post;
  };

  it('is signed by the easyrender team, as an Organization, unless it names an author', () => {
    expect(parsed({}).author).toEqual({ name: 'easyrender team', type: 'Organization' });
    expect(
      parsed({ author: 'A Writer', authorType: 'person', authorUrl: '/about' }).author,
    ).toEqual({
      name: 'A Writer',
      type: 'Person',
      url: '/about',
    });
    expect(parsePost('en', 'x', post({ ...VALID, authorType: 'robot' }))).toEqual({
      error: 'invalid authorType "robot"',
    });
  });

  it('signs every English guide on disk as Jorge Rodríguez, a Person', () => {
    const posts = readPosts('en');
    expect(posts.length).toBeGreaterThan(0);
    for (const entry of posts) {
      expect({ slug: entry.slug, author: entry.author }).toEqual({
        slug: entry.slug,
        author: { name: 'Jorge Rodríguez', type: 'Person', url: '/authors/jorge-rodriguez' },
      });
    }
  });

  it('fills prices from the harness, so a guide cannot drift from the pricing page', () => {
    const { body } = parsed(
      {},
      'A model costs {{renderCredits}} credits ({{renderPrice}}). Pro is {{proPrice}} for {{proCredits}}.',
    );
    const price = (RENDER_CREDITS * CREDIT_USD).toFixed(2);
    const pro = String(PRO_PLAN.priceCents / 100);
    const proCredits = PRO_PLAN.monthlyCredits.toLocaleString('en-US');
    expect(body).toBe(
      `A model costs ${RENDER_CREDITS} credits ($${price}). Pro is $${pro} for ${proCredits}.`,
    );
    expect(parsed({}, 'Left alone: {{unknownToken}}.').body).toBe('Left alone: {{unknownToken}}.');
  });

  it('drops editor notes before anything reads the body', () => {
    const { body } = parsed({}, 'Before.\n\n<!-- IMAGE PENDING: a real screenshot -->\n\nAfter.');
    expect(body).toBe('Before.\n\nAfter.');
  });

  it('reads the FAQ section as plain question and answer pairs', () => {
    const faq = faqFromBody(
      [
        '## Something else',
        '### Not a question',
        'Ignored.',
        '## FAQ',
        '### Is GLB the same as [glTF](/learn/glb-file)?',
        'The **binary** version.',
        'Same standard.',
        '### Empty?',
        '## After',
        'Ignored too.',
      ].join('\n'),
    );
    expect(faq).toEqual([
      { question: 'Is GLB the same as glTF?', answer: 'The binary version. Same standard.' },
    ]);
  });

  it('never dates the last change before the publication', () => {
    const date = '2026-11-11T00:00:00.000Z';
    expect(modifiedDate({ date, updated: '2026-11-10T00:00:00.000Z' })).toBe(date);
    expect(modifiedDate({ date, updated: '2026-11-20T00:00:00.000Z' })).toBe(
      '2026-11-20T00:00:00.000Z',
    );
  });
});

describe('the publication date is a schedule', () => {
  const fixture = () => {
    const root = mkdtempSync(join(tmpdir(), 'easyrender-blog-'));
    mkdirSync(join(root, 'en'), { recursive: true });
    writeFileSync(
      join(root, 'en', 'yesterday.md'),
      post({ ...VALID, group: 'a', date: '2026-11-09' }),
    );
    writeFileSync(
      join(root, 'en', 'tomorrow.md'),
      post({ ...VALID, group: 'b', date: '2026-11-11' }),
    );
    writeFileSync(join(root, 'en', 'broken.md'), 'no front matter at all');
    writeFileSync(join(root, 'en', 'notes.txt'), 'ignored');
    return root;
  };

  const NOW = new Date('2026-11-10T12:00:00Z');

  it('reads every valid post, newest first, and skips the rest', () => {
    const posts = readPosts('en', fixture());
    expect(posts.map((entry) => entry.slug)).toEqual(['tomorrow', 'yesterday']);
  });

  it('publishes a past date and hides a future one', () => {
    const posts = readPosts('en', fixture());
    const published = posts.filter((entry) => isPublishedPost(entry, NOW));
    expect(published.map((entry) => entry.slug)).toEqual(['yesterday']);
  });

  // de guides are published with the other locales. A past date is live; a future date stays hidden.
  it('publishes a past-dated guide once that language’s guides section is open', () => {
    const root = mkdtempSync(join(tmpdir(), 'easyrender-blog-de-'));
    mkdirSync(join(root, 'de'), { recursive: true });
    writeFileSync(join(root, 'de', 'glb-oder-usdz.md'), post({ ...VALID, date: '2026-11-01' }));
    writeFileSync(
      join(root, 'de', 'morgen.md'),
      post({ ...VALID, group: 'later', date: '2026-11-20' }),
    );
    const entries = readPosts('de', root);
    expect(entries.map((entry) => entry.slug)).toEqual(['morgen', 'glb-oder-usdz']);
    const live = entries.filter((entry) => isPublishedPost(entry, NOW));
    expect(live.map((entry) => entry.slug)).toEqual(['glb-oder-usdz']);
  });

  it('returns nothing for a language with no folder', () => {
    expect(readPosts('fr', mkdtempSync(join(tmpdir(), 'easyrender-blog-empty-')))).toEqual([]);
  });
});

describe('readingMinutes', () => {
  const words = (count: number) => Array.from({ length: count }, () => 'word').join(' ');

  it('rounds up at 230 words a minute and never says zero', () => {
    expect(readingMinutes('')).toBe(1);
    expect(readingMinutes(words(230))).toBe(1);
    expect(readingMinutes(words(231))).toBe(2);
    expect(readingMinutes(words(2300))).toBe(10);
  });

  it('counts the words a reader reads, not image lines, link targets or markup', () => {
    const body = [
      `## ${words(2)}`,
      '',
      '![A long alt text that is never read as prose](/showcase/armchair.jpg "And a caption")',
      '',
      `[${words(3)}](https://example.com/a-very-long-url) | --- | **${words(2)}**`,
      '',
      `- ${words(223)}`,
    ].join('\n');
    // 2 + 3 + 2 + 223 = 230 words: still one minute.
    expect(readingMinutes(body)).toBe(1);
  });
});

describe('relatedPosts', () => {
  const LATER = new Date('2026-11-17T12:00:00Z');

  it('lists other guides of the same language, newest first, never the post itself', () => {
    const post = getPost('en', 'glb-file', LATER);
    expect(post).not.toBeNull();
    const related = relatedPosts(post as NonNullable<typeof post>, 3, LATER);
    expect(related).toHaveLength(3);
    expect(related.map((entry) => entry.slug)).not.toContain('glb-file');
    expect(related.every((entry) => entry.locale === 'en')).toBe(true);
    const dates = related.map((entry) => entry.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('leaves out guides that are not published yet', () => {
    const first = getPost(
      'en',
      'how-to-make-a-3d-model-from-photos',
      new Date('2026-11-11T12:00:00Z'),
    );
    expect(first).not.toBeNull();
    const related = relatedPosts(
      first as NonNullable<typeof first>,
      3,
      new Date('2026-11-11T12:00:00Z'),
    );
    expect(related).toEqual([]);
  });
});

// This guide is already linked from the comparison hub and existing guides.
describe('the GLB guide linked on November 14', () => {
  const now = new Date('2026-11-14T00:00:00Z');
  it('resolves its canonical URL and appears in publication consumers', () => {
    expect(getPost('en', 'glb-file', now)?.path).toBe('/learn/glb-file');
    expect(listPosts('en', now).some((entry) => entry.slug === 'glb-file')).toBe(true);
    expect(isLiveBlogLink('en', now)('/learn/glb-file')).toBe(true);
    expect(getPost('en', 'usdz-file', now)).toBeNull();
  });
});
