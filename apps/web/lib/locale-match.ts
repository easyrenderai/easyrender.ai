import { isRoutableLocale, type Locale } from '@/i18n/config';
import { type BlogPost, getPost, readPosts } from '@/lib/blog/posts';
import { type ComparePage, getComparePage, listComparePages } from '@/lib/compare/pages';
import { guideAlias } from '@/lib/guide-alias';
import { isPublished, ROUTE_KEYS, ROUTES } from '@/lib/seo/routes';

// Everything below a language home, resolved through the route registry so only the native slugs
// it knows are served. English has one folder per page instead, because its paths are the plain
// English words and reading app/learn/[slug] is clearer than a dispatcher.
//
// Two dispatchers use it: app/[lang]/[...path] renders the pages that quote no money, and
// app/p/[key]/[lang]/[...path] the ones that do (PRICED_KINDS), once per pricing key.
//
// Adding a page type means adding its case in the dispatcher that renders it: a published registry
// entry with no case falls through to notFound, which is the safe direction.

export type Match =
  | { kind: 'sign-in' | 'sign-up'; locale: Locale }
  | { kind: 'redirect'; path: string }
  | { kind: 'author'; locale: Locale }
  | { kind: 'blogIndex'; locale: Locale }
  | { kind: 'post'; post: BlogPost }
  | { kind: 'compareIndex'; locale: Locale }
  | { kind: 'comparison'; page: ComparePage }
  | { kind: 'pricing'; locale: Locale }
  | { kind: 'api'; locale: Locale }
  | { kind: 'mcp'; locale: Locale }
  | { kind: 'ecommerce'; locale: Locale }
  | { kind: 'models'; locale: Locale }
  | { kind: 'viewer' | 'converter'; locale: Locale }
  | { kind: 'evals'; locale: Locale }
  | { kind: 'privacy' | 'terms'; locale: Locale }
  | { kind: 'cookies'; locale: Locale }
  | { kind: 'none' };

export function resolveLocalePath(lang: string, segments: string[]): Match {
  if (!isRoutableLocale(lang) || lang === 'en') return { kind: 'none' };
  const locale: Locale = lang;
  if (segments.length === 1 && (segments[0] === 'sign-in' || segments[0] === 'sign-up')) {
    return { kind: segments[0], locale };
  }
  if (segments.length === 2 && segments[0] === 'learn') {
    const target = guideAlias(locale, segments[1]);
    if (target) return { kind: 'redirect', path: target };
  }
  const path = `/${[locale, ...segments].join('/')}`;

  if (isPublished('author', locale) && path === ROUTES.author.paths[locale])
    return { kind: 'author', locale };

  if (isPublished('cookies', locale) && path === ROUTES.cookies.paths[locale])
    return { kind: 'cookies', locale };

  for (const kind of ['privacy', 'terms'] as const) {
    if (isPublished(kind, locale) && path === ROUTES[kind].paths[locale]) {
      return { kind, locale };
    }
  }

  if (isPublished('pricing', locale) && path === ROUTES.pricing.paths[locale]) {
    return { kind: 'pricing', locale };
  }
  if (isPublished('api', locale) && path === ROUTES.api.paths[locale]) {
    return { kind: 'api', locale };
  }
  if (isPublished('ecommerce', locale) && path === ROUTES.ecommerce.paths[locale]) {
    return { kind: 'ecommerce', locale };
  }
  if (isPublished('mcp', locale) && path === ROUTES.mcp.paths[locale]) {
    return { kind: 'mcp', locale };
  }
  if (isPublished('models', locale) && path === ROUTES.models.paths[locale]) {
    return { kind: 'models', locale };
  }
  for (const kind of ['viewer', 'converter'] as const) {
    if (isPublished(kind, locale) && path === ROUTES[kind].paths[locale]) {
      return { kind, locale };
    }
  }
  if (isPublished('evals', locale) && path === ROUTES.evals.paths[locale]) {
    return { kind: 'evals', locale };
  }

  if (isPublished('compare', locale)) {
    const hub = ROUTES.compare.paths[locale];
    if (path === hub) return { kind: 'compareIndex', locale };
    if (path.startsWith(`${hub}/`)) {
      const slug = path.slice(hub.length + 1);
      const page = slug.includes('/') ? null : getComparePage(slug, locale);
      if (page) return { kind: 'comparison', page };
    }
  }

  if (isPublished('blog', locale)) {
    const hub = ROUTES.blog.paths[locale];
    if (path === hub) return { kind: 'blogIndex', locale };
    if (path.startsWith(`${hub}/`)) {
      const slug = path.slice(hub.length + 1);
      const post = slug.includes('/') ? null : getPost(locale, slug);
      if (post) return { kind: 'post', post };
    }
  }

  return { kind: 'none' };
}

export const PRICED_KINDS: ReadonlySet<Match['kind']> = new Set([
  'pricing',
  'api',
  'ecommerce',
  'models',
]);

/**
 * The paths below a language home that are built ahead of time: every registered page, guide and
 * comparison the dispatcher serves for that locale, as the segments after the language. The language
 * layout answers 404 to any path outside this list (dynamicParams = false), so it also holds what
 * is not live yet: a guide dated tomorrow is built as a 404 and becomes the guide when its hourly
 * revalidation runs after its date, with no deploy. The old English guide addresses (/es/learn/slug)
 * are here too, because they redirect to the translation.
 */
export function localeStaticPaths(locale: Locale, isPriced: boolean): string[][] {
  if (locale === 'en') return [];
  const registry = new Set<string>(['/sign-in', '/sign-up'].map((tail) => `/${locale}${tail}`));
  for (const key of ROUTE_KEYS) {
    const path = (ROUTES[key].paths as Partial<Record<Locale, string>>)[locale];
    if (path && isPublished(key, locale)) registry.add(path);
  }
  const content = new Set<string>();
  if (!isPriced) {
    for (const post of readPosts(locale)) content.add(post.path);
    for (const page of listComparePages(locale)) content.add(page.path);
    for (const post of readPosts('en')) content.add(`/${locale}/learn/${post.slug}`);
  }
  const segments = (path: string) => path.split('/').filter(Boolean).slice(1);
  return [
    ...[...registry]
      .map(segments)
      .filter(
        (parts) =>
          parts.length > 0 && PRICED_KINDS.has(resolveLocalePath(locale, parts).kind) === isPriced,
      ),
    ...[...content].map(segments).filter((parts) => parts.length > 0),
  ];
}
