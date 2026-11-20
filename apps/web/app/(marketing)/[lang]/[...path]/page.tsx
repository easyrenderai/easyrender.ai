import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import SignInPage from '@/app/(app)/sign-in/page';
import SignUpPage from '@/app/(app)/sign-up/page';
import { AuthorView } from '@/components/author-view';
import { BlogIndexView } from '@/components/blog/blog-index-view';
import { BlogPostView } from '@/components/blog/blog-post-view';
import { CompareIndexView } from '@/components/compare/compare-index-view';
import { CompareView } from '@/components/compare/compare-view';
import { CookiesPage } from '@/components/cookies-page';
import { EvalsView } from '@/components/evals/evals-view';
import { LegalPage } from '@/components/legal-page';
import { McpView } from '@/components/mcp/mcp-view';
import { StudioLens } from '@/components/studio/lens';
import { StudioShell } from '@/components/studio/shell';
import { ConverterView } from '@/components/viewer/converter-view';
import { ViewerView } from '@/components/viewer/viewer-view';
import { isRoutableLocale, ROUTABLE_LOCALES } from '@/i18n/config';
import { localeStaticPaths, resolveLocalePath } from '@/lib/locale-match';
import { authMetadata } from '@/lib/seo/auth';
import { JsonLd } from '@/lib/seo/jsonld';
import {
  authorGraph,
  authorMetadata,
  blogIndexGraph,
  blogIndexMetadata,
  compareIndexGraph,
  compareIndexMetadata,
  comparePageGraph,
  comparePageMetadata,
  converterGraph,
  converterMetadata,
  cookiesMetadata,
  evalsGraph,
  evalsMetadata,
  legalMetadata,
  mcpGraph,
  mcpMetadata,
  postGraph,
  postMetadata,
  viewerGraph,
  viewerMetadata,
} from '@/lib/seo/pages';

// Built ahead of time for every page the registry serves and refreshed hourly, so a guide whose
// publication date has passed appears without a deploy. A path outside the list is built on its
// first request (and is a 404 when the registry does not know it).
export const revalidate = 3600;

export function generateStaticParams() {
  return ROUTABLE_LOCALES.filter((lang) => lang !== 'en').flatMap((lang) =>
    localeStaticPaths(lang, false).map((path) => ({ lang, path })),
  );
}

export async function generateMetadata({
  params,
}: PageProps<'/[lang]/[...path]'>): Promise<Metadata> {
  const { lang, path } = await params;
  if (isRoutableLocale(lang)) setRequestLocale(lang);
  const match = resolveLocalePath(lang, path);
  if (match.kind === 'redirect') permanentRedirect(match.path);
  if (match.kind === 'sign-in' || match.kind === 'sign-up')
    return authMetadata(match.kind, match.locale);
  if (match.kind === 'author') return authorMetadata(match.locale);
  if (match.kind === 'cookies') return cookiesMetadata(match.locale);
  if (match.kind === 'privacy' || match.kind === 'terms')
    return legalMetadata(match.kind, match.locale);
  if (match.kind === 'post') return postMetadata(match.post);
  if (match.kind === 'blogIndex') return blogIndexMetadata(match.locale);
  if (match.kind === 'comparison') return comparePageMetadata(match.page);
  if (match.kind === 'compareIndex') return compareIndexMetadata(match.locale);
  if (match.kind === 'mcp') return mcpMetadata(match.locale);
  if (match.kind === 'viewer') return viewerMetadata(match.locale);
  if (match.kind === 'converter') return converterMetadata(match.locale);
  if (match.kind === 'evals') return evalsMetadata(match.locale);
  return {};
}

export default async function LocalePage({ params }: PageProps<'/[lang]/[...path]'>) {
  const { lang, path } = await params;
  // The layout does this too, but a page renders alongside it: without this its translations
  // could be read before the language is known and come out in English.
  if (isRoutableLocale(lang)) setRequestLocale(lang);
  const match = resolveLocalePath(lang, path);
  if (match.kind === 'redirect') permanentRedirect(match.path);
  if (match.kind === 'sign-in' || match.kind === 'sign-up') {
    return (
      <StudioShell>
        <div className="auth">
          <div className="auth__form">
            {match.kind === 'sign-in' ? <SignInPage /> : <SignUpPage />}
          </div>
          <StudioLens />
        </div>
      </StudioShell>
    );
  }
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
  if (match.kind === 'mcp') {
    return (
      <>
        <JsonLd graph={await mcpGraph(match.locale)} />
        <McpView locale={match.locale} />
      </>
    );
  }
  if (match.kind === 'viewer') {
    return (
      <>
        <JsonLd graph={await viewerGraph(match.locale)} />
        <ViewerView locale={match.locale} />
      </>
    );
  }
  if (match.kind === 'converter') {
    return (
      <>
        <JsonLd graph={await converterGraph(match.locale)} />
        <ConverterView locale={match.locale} />
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
