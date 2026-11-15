import { LOCALES, type Locale } from '@/i18n/config';
import {
  indexableBlogIndexPaths,
  isBlogIndexIndexable,
  listPosts,
  modifiedDate,
  postLivePaths,
} from '@/lib/blog/posts';
import { compareLivePaths, isComparePublished, listComparePages } from '@/lib/compare/pages';
import { hasPublishedRuns } from '@/lib/evals';
import {
  type ChangeFrequency,
  hreflangFor,
  liveLocales,
  livePaths,
  ROUTE_KEYS,
  ROUTES,
} from './routes';
import { absoluteUrl, SITE_URL } from './site';

// Sitemaps are generated from the route registry and the content files, never hand-written, so
// they cannot list a URL that does not answer 200 and cannot miss one that does. A noindex page
// is absent by construction: it has no registry entry.

export type SitemapEntry = {
  path: string;
  lastModified?: string;
  changeFrequency: ChangeFrequency;
  priority: number;
  /** Equivalents in other languages, for xhtml:link. */
  alternates: Partial<Record<Locale, string>>;
};

/** Everything a locale publishes today: its registry pages and its live posts. */
export function localeEntries(locale: Locale, now: Date = new Date()): SitemapEntry[] {
  const entries: SitemapEntry[] = [];

  for (const key of ROUTE_KEYS) {
    if (!liveLocales(key).includes(locale)) continue;
    // The guides hub is noindex while it is thin, so it must not be listed either.
    if (key === 'blog' && !isBlogIndexIndexable(locale, now)) continue;
    // The evals page is noindex until a run is published, so it is not listed either.
    if (key === 'evals' && !hasPublishedRuns()) continue;
    const entry = ROUTES[key];
    const posts = key === 'blog' ? listPosts(locale, now) : [];
    entries.push({
      path: entry.paths[locale],
      changeFrequency: entry.changeFrequency,
      priority: entry.priority,
      // The hub's alternates are the other indexable hubs only: never a noindex page.
      alternates: key === 'blog' ? indexableBlogIndexPaths(now) : livePaths(key),
      // The guides index changes when its newest guide does.
      ...(posts[0] ? { lastModified: modifiedDate(posts[0]) } : {}),
    });
    // Individual comparisons live under the locale hub, like guides under /learn/{slug}.
    // Alternates are only the translations that exist, so a missing file is never listed.
    if (key === 'compare' && isComparePublished(locale)) {
      for (const page of listComparePages(locale)) {
        entries.push({
          path: page.path,
          changeFrequency: 'monthly',
          priority: 0.6,
          alternates: compareLivePaths(page.group),
          ...(page.updated ? { lastModified: page.updated } : {}),
        });
      }
    }
  }

  for (const post of listPosts(locale, now)) {
    entries.push({
      path: post.path,
      lastModified: modifiedDate(post),
      changeFrequency: 'monthly',
      priority: 0.6,
      alternates: postLivePaths(post.group, now),
    });
  }

  return entries;
}

/** The locales with at least one URL to list, so the index never points at an empty sitemap. */
export function sitemapLocales(now: Date = new Date()): Locale[] {
  return LOCALES.filter((locale) => localeEntries(locale, now).length > 0);
}

export const sitemapPath = (locale: Locale): string => `/sitemap-${locale}.xml`;

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// hreflangFor decides what the block contains, including when there is no block at all, so the
// sitemap and the <head> cannot disagree about a page's alternates.
function urlNode(entry: SitemapEntry): string {
  const links = Object.entries(hreflangFor(entry.alternates) ?? {}).map(
    ([tag, href]) =>
      `    <xhtml:link rel="alternate" hreflang="${tag}" href="${escapeXml(href)}"/>`,
  );
  return [
    '  <url>',
    `    <loc>${escapeXml(absoluteUrl(entry.path))}</loc>`,
    ...(entry.lastModified ? [`    <lastmod>${entry.lastModified}</lastmod>`] : []),
    `    <changefreq>${entry.changeFrequency}</changefreq>`,
    `    <priority>${entry.priority}</priority>`,
    ...links,
    '  </url>',
  ].join('\n');
}

export function localeSitemapXml(locale: Locale, now: Date = new Date()): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...localeEntries(locale, now).map(urlNode),
    '</urlset>',
    '',
  ].join('\n');
}

export function sitemapIndexXml(now: Date = new Date()): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemapLocales(now).map((locale) =>
      ['  <sitemap>', `    <loc>${SITE_URL}${sitemapPath(locale)}</loc>`, '  </sitemap>'].join(
        '\n',
      ),
    ),
    '</sitemapindex>',
    '',
  ].join('\n');
}

const HEADERS = {
  'content-type': 'application/xml; charset=utf-8',
  // Short, because a scheduled post has to appear on its day without a deploy.
  'cache-control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=3600',
};

export const xmlResponse = (body: string): Response => new Response(body, { headers: HEADERS });
