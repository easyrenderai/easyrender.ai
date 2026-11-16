import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiView } from '@/components/api-landing/api-view';
import { AuthorView } from '@/components/author-view';
import { BlogIndexView } from '@/components/blog/blog-index-view';
import { BlogPostView } from '@/components/blog/blog-post-view';
import { CompareIndexView } from '@/components/compare/compare-index-view';
import { CompareView } from '@/components/compare/compare-view';
import { CookiesPage } from '@/components/cookies-page';
import { EcommerceView } from '@/components/ecommerce/ecommerce-view';
import { EvalsView } from '@/components/evals/evals-view';
import { LegalPage } from '@/components/legal-page';
import { McpView } from '@/components/mcp/mcp-view';
import { ModelsView } from '@/components/models/models-view';
import { PricingView } from '@/components/pricing/pricing-view';
import { isRoutableLocale, type Locale } from '@/i18n/config';
import { type BlogPost, getPost } from '@/lib/blog/posts';
import { type ComparePage, getComparePage } from '@/lib/compare/pages';
import { JsonLd } from '@/lib/seo/jsonld';
import {
  apiGraph,
  apiMetadata,
  authorGraph,
  authorMetadata,
  blogIndexGraph,
  blogIndexMetadata,
  compareIndexGraph,
  compareIndexMetadata,
  comparePageGraph,
  comparePageMetadata,
  cookiesMetadata,
  ecommerceGraph,
  ecommerceMetadata,
  evalsGraph,
  evalsMetadata,
  legalMetadata,
  mcpGraph,
  mcpMetadata,
  modelsGraph,
  modelsMetadata,
  postGraph,
  postMetadata,
  pricingGraph,
  pricingMetadata,
} from '@/lib/seo/pages';
import { isPublished, ROUTES } from '@/lib/seo/routes';

// Everything below a language home, resolved through the route registry so only the native slugs
// it knows are served. English has one folder per page instead, because its paths are the plain
// English words and reading app/learn/[slug] is clearer than a dispatcher.
//
// Adding a page type here means adding its case: a published registry entry with no case falls
// through to notFound, which is the safe direction.

type Match =
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
  | { kind: 'evals'; locale: Locale }
  | { kind: 'privacy' | 'terms'; locale: Locale }
  | { kind: 'cookies'; locale: Locale }
  | { kind: 'none' };

function resolve(lang: string, segments: string[]): Match {
  if (!isRoutableLocale(lang) || lang === 'en') return { kind: 'none' };
  const locale: Locale = lang;
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

export async function generateMetadata({
  params,
}: PageProps<'/[lang]/[...path]'>): Promise<Metadata> {
  const { lang, path } = await params;
  const match = resolve(lang, path);
  if (match.kind === 'author') return authorMetadata(match.locale);
  if (match.kind === 'cookies') return cookiesMetadata(match.locale);
  if (match.kind === 'privacy' || match.kind === 'terms')
    return legalMetadata(match.kind, match.locale);
  if (match.kind === 'post') return postMetadata(match.post);
  if (match.kind === 'blogIndex') return blogIndexMetadata(match.locale);
  if (match.kind === 'comparison') return comparePageMetadata(match.page);
  if (match.kind === 'compareIndex') return compareIndexMetadata(match.locale);
  if (match.kind === 'pricing') return pricingMetadata(match.locale);
  if (match.kind === 'api') return apiMetadata(match.locale);
  if (match.kind === 'mcp') return mcpMetadata(match.locale);
  if (match.kind === 'ecommerce') return ecommerceMetadata(match.locale);
  if (match.kind === 'models') return modelsMetadata(match.locale);
  if (match.kind === 'evals') return evalsMetadata(match.locale);
  return {};
}

export default async function LocalePage({ params }: PageProps<'/[lang]/[...path]'>) {
  const { lang, path } = await params;
  const match = resolve(lang, path);
  if (match.kind === 'author')
    return (
      <>
        <JsonLd graph={await authorGraph(match.locale)} />
        <AuthorView locale={match.locale} />
      </>
    );
  if (match.kind === 'cookies') return <CookiesPage />;

  if (match.kind === 'privacy' || match.kind === 'terms') {
    return <LegalPage kind={match.kind} locale={match.locale} />;
  }

  if (match.kind === 'blogIndex') {
    return (
      <>
        <JsonLd graph={await blogIndexGraph(match.locale)} />
        <BlogIndexView locale={match.locale} />
      </>
    );
  }
  if (match.kind === 'post') {
    return (
      <>
        <JsonLd graph={await postGraph(match.post)} />
        <BlogPostView post={match.post} />
      </>
    );
  }
  if (match.kind === 'compareIndex') {
    return (
      <>
        <JsonLd graph={await compareIndexGraph(match.locale)} />
        <CompareIndexView locale={match.locale} />
      </>
    );
  }
  if (match.kind === 'comparison') {
    return (
      <>
        <JsonLd graph={await comparePageGraph(match.page)} />
        <CompareView page={match.page} />
      </>
    );
  }
  if (match.kind === 'pricing') {
    return (
      <>
        <JsonLd graph={await pricingGraph(match.locale)} />
        <PricingView locale={match.locale} />
      </>
    );
  }
  if (match.kind === 'api') {
    return (
      <>
        <JsonLd graph={await apiGraph(match.locale)} />
        <ApiView locale={match.locale} />
      </>
    );
  }
  if (match.kind === 'ecommerce') {
    return (
      <>
        <JsonLd graph={await ecommerceGraph(match.locale)} />
        <EcommerceView locale={match.locale} />
      </>
    );
  }
  if (match.kind === 'mcp') {
    return (
      <>
        <JsonLd graph={await mcpGraph(match.locale)} />
        <McpView locale={match.locale} />
      </>
    );
  }
  if (match.kind === 'models') {
    return (
      <>
        <JsonLd graph={await modelsGraph(match.locale)} />
        <ModelsView locale={match.locale} />
      </>
    );
  }
  if (match.kind === 'evals') {
    return (
      <>
        <JsonLd graph={await evalsGraph(match.locale)} />
        <EvalsView locale={match.locale} />
      </>
    );
  }
  notFound();
}
