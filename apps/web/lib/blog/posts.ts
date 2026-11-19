import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CREDIT_USD, PAYG, PRO_PLAN, RENDER_CREDITS } from '@easyrender/harness';
import { LOCALES, type Locale, ROUTABLE_LOCALES } from '@/i18n/config';
import { ROUTES } from '@/lib/seo/routes';
import { isFaqHeading } from './faq';
import { parseContentDate, parseFrontMatter } from './frontmatter';

// Posts are content files: content/blog/{locale}/{slug}.md, one file per language per post.
//
//   ---
//   group: glb-vs-usdz          ties the six translations together for hreflang
//   title: GLB or USDZ?
//   description: One sentence for the search result and the card.
//   date: 2026-11-23            publishes at 00:00 UTC that day (Jorge, 11-nov-2026); a future date stays invisible
//   updated: 2026-11-30         optional, the date of the last real change
//   keyword: glb to usdz        optional, the target query, for the record
//   author: easyrender team     optional, defaults to the team; week 1 guides name Jorge Rodríguez (person, 11-nov-2026)
//   authorType: organization    optional, `person` only for a real, agreed author
//   authorUrl: /about           optional
//   cta: One sentence above the closing button.   optional
//   ---
//
// Prices are never typed into a post: write {{renderCredits}}, {{renderPrice}}, {{creditPrice}},
// {{paygMinCredits}}, {{paygMinPrice}}, {{proPrice}} or {{proCredits}} and the loader fills them
// in from @easyrender/harness, so a price change reaches every guide on the next deploy.
//
// An HTML comment (`<!-- IMAGE PENDING: ... -->`) is a note for the editor. It is stripped before
// the post is rendered, listed in llms-full.txt or turned into structured data.
//
// `date` is what makes one-post-a-day work: a week of posts can be committed at once and each
// one appears on its day, in the index, in the sitemap and at its own URL, with no deploy. The
// pages are server rendered, so the gate is applied per request.

export type BlogAuthor = {
  name: string;
  type: 'Person' | 'Organization';
  /** Absolute or site-relative. */
  url?: string;
};

export type FaqItem = { question: string; answer: string };

export type BlogPost = {
  locale: Locale;
  slug: string;
  group: string;
  title: string;
  description: string;
  /** Publication instant, ISO 8601. */
  date: string;
  /** Last real change, ISO 8601. Can be earlier than `date` for a post written ahead. */
  updated?: string;
  keyword?: string;
  author: BlogAuthor;
  /** The closing call to action sentence, shown above the button. */
  cta?: string;
  body: string;
  /** The questions under the FAQ heading, as plain text, for the FAQPage. */
  faq: FaqItem[];
  /** Site-relative URL. */
  path: string;
};

/** A file that names no author still defaults to the team, as an Organization. Week 1 guides name Jorge Rodríguez as a Person (11-nov-2026). */
export const DEFAULT_AUTHOR: BlogAuthor = { name: 'Easy Render team', type: 'Organization' };

/** dateModified and lastmod: never earlier than the publication date. */
export const modifiedDate = (post: Pick<BlogPost, 'date' | 'updated'>): string =>
  post.updated && post.updated > post.date ? post.updated : post.date;

// Whole dollars without cents ($49, $5), anything else to the cent ($0.80, $0.01).
const usd = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    ...(Number.isInteger(value) ? { maximumFractionDigits: 0 } : {}),
  }).format(value);

const PRICE_TOKENS: Record<string, string> = {
  renderCredits: String(RENDER_CREDITS),
  renderPrice: usd(RENDER_CREDITS * CREDIT_USD),
  creditPrice: usd(CREDIT_USD),
  paygMinCredits: PAYG.min.toLocaleString('en-US'),
  paygMinPrice: usd(PAYG.min * CREDIT_USD),
  proPrice: usd(PRO_PLAN.priceCents / 100),
  proCredits: PRO_PLAN.monthlyCredits.toLocaleString('en-US'),
};

/** Fills the price tokens from the harness. An unknown token is left as typed, so review sees it. */
export const fillPrices = (text: string): string =>
  text.replace(/\{\{(\w+)\}\}/g, (match, name: string) => PRICE_TOKENS[name] ?? match);

export const stripComments = (text: string): string =>
  text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/** Markdown inline syntax reduced to its words. */
export const plainText = (markdown: string): string =>
  markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

// An adult reads running prose at roughly 200-250 words a minute; 230 is the usual middle value.
const WORDS_PER_MINUTE = 230;

/**
 * Minutes to read a post body, rounded up, never under one. Computed from the words themselves
 * (no figures, captions or table pipes counted), so it is never typed into a post by hand.
 */
export function readingMinutes(body: string): number {
  const prose = body
    .split('\n')
    .filter((line) => !/^\s*!\[/.test(line))
    .join(' ');
  // Markers such as `|`, `##` or `-` hold no letter, so they are not counted as words.
  const words = plainText(prose)
    .split(' ')
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

/** The `### question` and its answer paragraphs under the FAQ heading of a post body. */
export function faqFromBody(body: string): FaqItem[] {
  const items: FaqItem[] = [];
  let isInFaq = false;
  let current: { question: string; lines: string[] } | null = null;
  const flush = () => {
    if (current) {
      const answer = plainText(current.lines.join(' '));
      if (answer) items.push({ question: plainText(current.question), answer });
    }
    current = null;
  };
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    const h2 = /^##\s+(.*)$/.exec(line);
    if (h2) {
      flush();
      isInFaq = isFaqHeading(h2[1] as string);
      continue;
    }
    if (!isInFaq) continue;
    const h3 = /^###\s+(.*)$/.exec(line);
    if (h3) {
      flush();
      current = { question: h3[1] as string, lines: [] };
      continue;
    }
    if (current && line) current.lines.push(line);
  }
  flush();
  return items;
}

const AUTHOR_TYPES: Record<string, BlogAuthor['type']> = {
  organization: 'Organization',
  person: 'Person',
};

const CONTENT_ROOT = join(process.cwd(), 'content', 'blog');

/** Where a post lives, given its locale and slug. */
export const postPath = (locale: Locale, slug: string): string =>
  `${ROUTES.blog.paths[locale]}/${encodeURIComponent(slug)}`;

/**
 * Turns one content file into a post. Returns the reason instead of throwing so that a single
 * malformed file cannot take the whole blog down; readPosts logs it and moves on.
 */
export function parsePost(
  locale: Locale,
  slug: string,
  source: string,
): { post: BlogPost } | { error: string } {
  const { data, body } = parseFrontMatter(source);
  for (const field of ['group', 'title', 'description', 'date'] as const) {
    if (!data[field]) return { error: `missing ${field}` };
  }
  const date = parseContentDate(data.date as string);
  if (!date) return { error: `invalid date "${data.date}"` };
  const updated = data.updated ? parseContentDate(data.updated) : null;
  if (data.updated && !updated) return { error: `invalid updated "${data.updated}"` };
  const text = fillPrices(stripComments(body));
  if (!text) return { error: 'empty body' };
  const authorType = AUTHOR_TYPES[(data.authorType ?? 'organization').toLowerCase()];
  if (!authorType) return { error: `invalid authorType "${data.authorType}"` };
  const author: BlogAuthor = data.author
    ? {
        name: data.author,
        type: authorType,
        ...(data.authorUrl
          ? { url: data.authorUrl }
          : data.author === 'Jorge Rodríguez' && authorType === 'Person'
            ? { url: ROUTES.author.paths[locale] }
            : {}),
      }
    : DEFAULT_AUTHOR;

  return {
    post: {
      locale,
      slug,
      group: data.group as string,
      title: fillPrices(data.title as string),
      description: fillPrices(data.description as string),
      date,
      ...(updated ? { updated } : {}),
      ...(data.keyword ? { keyword: data.keyword } : {}),
      author,
      ...(data.cta ? { cta: fillPrices(data.cta) } : {}),
      body: text,
      faq: faqFromBody(text),
      path: postPath(locale, slug),
    },
  };
}

const cache = new Map<Locale, BlogPost[]>();

/** Every post written for a locale, published or not, newest first. */
export function readPosts(locale: Locale, root: string = CONTENT_ROOT): BlogPost[] {
  const cached = root === CONTENT_ROOT ? cache.get(locale) : undefined;
  if (cached) return cached;

  let files: string[];
  try {
    files = readdirSync(join(root, locale));
  } catch {
    files = [];
  }

  const posts: BlogPost[] = [];
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const slug = file.slice(0, -3);
    const result = parsePost(locale, slug, readFileSync(join(root, locale, file), 'utf8'));
    if ('error' in result) {
      console.warn(`blog: skipping ${locale}/${file}: ${result.error}`);
      continue;
    }
    posts.push(result.post);
  }
  posts.sort((a, b) => b.date.localeCompare(a.date));

  // Content only changes on deploy, and the publication gate is applied per request, so caching
  // the parsed files is safe. Not in development, where the files are being edited.
  if (root === CONTENT_ROOT && process.env.NODE_ENV === 'production') cache.set(locale, posts);
  return posts;
}

const isRoutable = (locale: Locale) => (ROUTABLE_LOCALES as readonly Locale[]).includes(locale);

// A post is live only where the guides section itself is published: a routable locale (its home
// is open) does not open its blog. Without this gate a German post merged before /de/ratgeber is
// published would be listed in sitemap-de.xml and in hreflang while its URL answers 404.
export const isPublishedPost = (post: BlogPost, now: Date): boolean =>
  isRoutable(post.locale) &&
  isPublishedIndex(post.locale) &&
  Date.parse(post.date) <= now.getTime();

/** The posts a locale shows today, newest first. */
export function listPosts(locale: Locale, now: Date = new Date()): BlogPost[] {
  return readPosts(locale).filter((post) => isPublishedPost(post, now));
}

/**
 * For links inside a guide: a link to another guide of the same hub is live only once that guide
 * is published. Every other site link is left alone.
 */
export function isLiveBlogLink(locale: Locale, now: Date = new Date()): (href: string) => boolean {
  const hub = `${ROUTES.blog.paths[locale]}/`;
  const live = new Set(listPosts(locale, now).map((post) => post.path));
  return (href) => {
    const path = href.split('#')[0] as string;
    return !path.startsWith(hub) || live.has(path);
  };
}

/** One published post, or null: a future-dated or unknown slug is a 404. */
export function getPost(locale: Locale, slug: string, now: Date = new Date()): BlogPost | null {
  return listPosts(locale, now).find((post) => post.slug === slug) ?? null;
}

/** Other guides of the same language to read next, newest first, never the post itself. */
export function relatedPosts(post: BlogPost, limit = 3, now: Date = new Date()): BlogPost[] {
  return listPosts(post.locale, now)
    .filter((other) => other.slug !== post.slug)
    .slice(0, limit);
}

// A hub with one or two guides is a thin page, so it stays out of the index until it has
// something to be an index of (arch doc, section 1: "index con >= 3 guias").
export const MIN_INDEXABLE_POSTS = 3;

export const isBlogIndexIndexable = (locale: Locale, now: Date = new Date()): boolean =>
  listPosts(locale, now).length >= MIN_INDEXABLE_POSTS;

/**
 * The live URL of a post in each language, so its hreflang block only lists translations that
 * are actually published today.
 */
export function postLivePaths(
  group: string,
  now: Date = new Date(),
): Partial<Record<Locale, string>> {
  const paths: Partial<Record<Locale, string>> = {};
  for (const locale of LOCALES) {
    const match = listPosts(locale, now).find((post) => post.group === group);
    if (match) paths[locale] = match.path;
  }
  return paths;
}

/**
 * The guides hubs that are in the index today, keyed by locale. A hub stays noindex until it has
 * MIN_INDEXABLE_POSTS guides, and hreflang must never point at a noindex page, so the hreflang
 * block of a hub (in the head and in the sitemap) is built from this list only.
 */
export function indexableBlogIndexPaths(now: Date = new Date()): Partial<Record<Locale, string>> {
  const paths: Partial<Record<Locale, string>> = {};
  for (const locale of LOCALES) {
    if (isRoutable(locale) && isPublishedIndex(locale) && isBlogIndexIndexable(locale, now)) {
      paths[locale] = ROUTES.blog.paths[locale];
    }
  }
  return paths;
}

const isPublishedIndex = (locale: Locale): boolean =>
  (ROUTES.blog.published as readonly Locale[]).includes(locale);
