import { RENDER_CREDITS } from '@easyrender/harness';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { faqItems } from '@/components/landing';
import type { Locale } from '@/i18n/config';
import { schemaImage } from '@/lib/blog/images';
import type { BlogPost } from '@/lib/blog/posts';
import {
  indexableBlogIndexPaths,
  isBlogIndexIndexable,
  modifiedDate,
  postLivePaths,
} from '@/lib/blog/posts';
import { COMPARE_INDEX, type ComparePage, compareLivePaths } from '@/lib/compare/pages';
import { hasPublishedRuns } from '@/lib/evals';
import { formatCount, formatMoney } from '@/lib/price-format';
import {
  article,
  breadcrumbList,
  faqPage,
  organization,
  softwareApplication,
  webPage,
  website,
} from './jsonld';
import { pageMetadata } from './metadata';
import { livePaths, ROUTES } from './routes';
import { absoluteUrl } from './site';

// The head and the structured data of every indexable page, in one place, so the home in English
// and the home in Spanish are built the same way and only the words differ.

export async function authorMetadata(locale: Locale): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'Author' });
  return pageMetadata({
    locale,
    path: ROUTES.author.paths[locale],
    title: t('metaTitle'),
    description: t('bio'),
    alternates: livePaths('author'),
  });
}

export async function authorGraph(locale: Locale) {
  const t = await getTranslations({ locale, namespace: 'Author' });
  const url = absoluteUrl(ROUTES.author.paths[locale]);
  return [
    organization(),
    {
      '@type': 'ProfilePage',
      '@id': url,
      url,
      mainEntity: {
        '@type': 'Person',
        '@id': `${url}#person`,
        name: 'Jorge Rodríguez',
        url,
        description: t('bio'),
        affiliation: { '@id': `${absoluteUrl('/')}/#organization` },
      },
    },
  ];
}

export async function legalMetadata(kind: 'privacy' | 'terms', locale: Locale): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: `Legal.${kind}` });
  return pageMetadata({
    locale,
    path: ROUTES[kind].paths[locale],
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: livePaths(kind),
  });
}

export async function cookiesMetadata(locale: Locale): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'Analytics' });
  return pageMetadata({
    locale,
    path: ROUTES.cookies.paths[locale],
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: livePaths('cookies'),
  });
}

export async function homeMetadata(locale: Locale): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'Home.meta' });
  return pageMetadata({
    locale,
    path: ROUTES.home.paths[locale],
    title: t('title'),
    description: t('description'),
    alternates: livePaths('home'),
  });
}

/** Organization, WebSite, WebPage, SoftwareApplication and the FAQ, cross-referenced by @id. */
export async function homeGraph(locale: Locale) {
  const { currentPricing } = await import('@/lib/pricing');
  const [t, items] = await Promise.all([
    getTranslations({ locale, namespace: 'Home.meta' }),
    faqItems(),
  ]);
  const pricing = await currentPricing();
  return [
    organization(),
    website(locale),
    webPage(locale, ROUTES.home.paths[locale], t('title'), t('description')),
    softwareApplication(locale, t('description'), pricing.variant, pricing.currency),
    faqPage(items),
  ];
}

/**
 * The pricing page. Same head in every language it is open in. The description quotes the
 * current price of one render, so it follows the pricing variant like the page itself.
 */
export async function pricingMetadata(locale: Locale): Promise<Metadata> {
  const { currentPricing } = await import('@/lib/pricing');
  const [t, pricing] = await Promise.all([
    getTranslations({ locale, namespace: 'Pricing' }),
    currentPricing(),
  ]);
  return pageMetadata({
    locale,
    path: ROUTES.pricing.paths[locale],
    title: t('metaTitle'),
    description: t('metaDescription', {
      credits: RENDER_CREDITS,
      price: formatMoney(locale, RENDER_CREDITS * pricing.creditPrice, pricing.currency),
      proCredits: formatCount(locale, pricing.plans.pro.monthlyCredits),
    }),
    alternates: livePaths('pricing'),
  });
}

/** Organization, the page, its breadcrumb, the product with its offers, and the pricing FAQ. */
export async function pricingGraph(locale: Locale) {
  const [{ currentPricing }, { pricingFaqItems }] = await Promise.all([
    import('@/lib/pricing'),
    import('@/components/pricing/pricing-view'),
  ]);
  const [t, items, pricing] = await Promise.all([
    getTranslations({ locale, namespace: 'Pricing' }),
    pricingFaqItems(locale),
    currentPricing(),
  ]);
  const description = t('metaDescription', {
    credits: RENDER_CREDITS,
    price: formatMoney(locale, RENDER_CREDITS * pricing.creditPrice, pricing.currency),
    proCredits: formatCount(locale, pricing.plans.pro.monthlyCredits),
  });
  return [
    organization(),
    webPage(locale, ROUTES.pricing.paths[locale], t('metaTitle'), description),
    softwareApplication(locale, description, pricing.variant, pricing.currency),
    breadcrumbList([
      { name: t('home'), path: ROUTES.home.paths[locale] },
      { name: t('breadcrumb'), path: ROUTES.pricing.paths[locale] },
    ]),
    faqPage(items, `${absoluteUrl(ROUTES.pricing.paths[locale])}#faq`),
  ];
}

/**
 * The guides hub. noindex while it has fewer than MIN_INDEXABLE_POSTS guides, and its hreflang
 * only lists hubs that are themselves indexable, so no alternate ever points at a noindex page.
 */
export async function blogIndexMetadata(locale: Locale): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'Blog.index' });
  const isIndexable = isBlogIndexIndexable(locale);
  const metadata = pageMetadata({
    locale,
    path: ROUTES.blog.paths[locale],
    title: t('metaTitle'),
    description: t('metaDescription'),
    ...(isIndexable ? { alternates: indexableBlogIndexPaths() } : {}),
  });
  return isIndexable ? metadata : { ...metadata, robots: { index: false, follow: true } };
}

export async function blogIndexGraph(locale: Locale) {
  const t = await getTranslations({ locale, namespace: 'Blog' });
  return [
    breadcrumbList([
      { name: t('breadcrumb.home'), path: ROUTES.home.paths[locale] },
      { name: t('index.title'), path: ROUTES.blog.paths[locale] },
    ]),
  ];
}

/** MCP landing: the visible FAQ and schema share their localized content. */
export async function mcpMetadata(locale: Locale): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'McpLanding.meta' });
  return pageMetadata({
    locale,
    path: ROUTES.mcp.paths[locale],
    title: t('title'),
    description: t('description'),
    alternates: livePaths('mcp'),
  });
}

export async function mcpGraph(locale: Locale) {
  const { mcpFaqItems } = await import('@/components/mcp/mcp-view');
  const [t, items] = await Promise.all([
    getTranslations({ locale, namespace: 'McpLanding.meta' }),
    mcpFaqItems(locale),
  ]);
  return [
    organization(),
    webPage(locale, ROUTES.mcp.paths[locale], t('title'), t('description')),
    faqPage(items, `${absoluteUrl(ROUTES.mcp.paths[locale])}#faq`),
  ];
}

/** E-commerce landing: the visible FAQ and schema share their localized content. */
export async function ecommerceMetadata(locale: Locale): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'EcommerceLanding.meta' });
  return pageMetadata({
    locale,
    path: ROUTES.ecommerce.paths[locale],
    title: t('title'),
    description: t('description'),
    alternates: livePaths('ecommerce'),
  });
}

export async function ecommerceGraph(locale: Locale) {
  const { ecommerceFaqItems } = await import('@/components/ecommerce/ecommerce-view');
  const [t, items] = await Promise.all([
    getTranslations({ locale, namespace: 'EcommerceLanding' }),
    ecommerceFaqItems(locale),
  ]);
  return [
    organization(),
    webPage(locale, ROUTES.ecommerce.paths[locale], t('meta.title'), t('meta.description')),
    breadcrumbList([
      { name: t('home'), path: ROUTES.home.paths[locale] },
      { name: t('breadcrumb'), path: ROUTES.ecommerce.paths[locale] },
    ]),
    faqPage(items, `${absoluteUrl(ROUTES.ecommerce.paths[locale])}#faq`),
  ];
}

/** REST API landing: the visible FAQ and schema share their localized content. */
export async function apiMetadata(locale: Locale): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'ApiLanding.meta' });
  return pageMetadata({
    locale,
    path: ROUTES.api.paths[locale],
    title: t('title'),
    description: t('description'),
    alternates: livePaths('api'),
  });
}

export async function apiGraph(locale: Locale) {
  const { apiFaqItems } = await import('@/components/api-landing/api-view');
  const [t, items] = await Promise.all([
    getTranslations({ locale, namespace: 'ApiLanding.meta' }),
    apiFaqItems(locale),
  ]);
  return [
    organization(),
    webPage(locale, ROUTES.api.paths[locale], t('title'), t('description')),
    faqPage(items, `${absoluteUrl(ROUTES.api.paths[locale])}#faq`),
  ];
}

/** The free 3D file viewer. */
export async function viewerMetadata(locale: Locale): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'Viewer' });
  return pageMetadata({
    locale,
    path: ROUTES.viewer.paths[locale],
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: livePaths('viewer'),
  });
}

export async function viewerGraph(locale: Locale) {
  const { viewerFaqItems } = await import('@/components/viewer/viewer-view');
  const [t, items] = await Promise.all([
    getTranslations({ locale, namespace: 'Viewer' }),
    viewerFaqItems(locale),
  ]);
  const path = ROUTES.viewer.paths[locale];
  return [
    organization(),
    webPage(locale, path, t('metaTitle'), t('metaDescription')),
    breadcrumbList([
      { name: t('home'), path: ROUTES.home.paths[locale] },
      { name: t('breadcrumb'), path },
    ]),
    faqPage(items, `${absoluteUrl(path)}#faq`),
  ];
}

/** The models page. Same head and structured data in every language it is open in. */
export async function modelsMetadata(locale: Locale): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'Models' });
  return pageMetadata({
    locale,
    path: ROUTES.models.paths[locale],
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: livePaths('models'),
  });
}

export async function modelsGraph(locale: Locale) {
  const t = await getTranslations({ locale, namespace: 'Models' });
  return [
    organization(),
    webPage(locale, ROUTES.models.paths[locale], t('metaTitle'), t('metaDescription')),
    breadcrumbList([
      { name: t('home'), path: ROUTES.home.paths[locale] },
      { name: t('breadcrumb'), path: ROUTES.models.paths[locale] },
    ]),
  ];
}

/**
 * The evals page. noindex until a run is published, like the guides hub while it is thin: a page
 * whose results section is empty is not offered to a crawler, and the sitemap leaves it out too.
 */
export async function evalsMetadata(locale: Locale): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'Evals' });
  const metadata = pageMetadata({
    locale,
    path: ROUTES.evals.paths[locale],
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: livePaths('evals'),
  });
  return hasPublishedRuns() ? metadata : { ...metadata, robots: { index: false, follow: true } };
}

export async function evalsGraph(locale: Locale) {
  const t = await getTranslations({ locale, namespace: 'Evals' });
  return [
    organization(),
    webPage(locale, ROUTES.evals.paths[locale], t('metaTitle'), t('metaDescription')),
    breadcrumbList([
      { name: t('home'), path: ROUTES.home.paths[locale] },
      { name: t('breadcrumb'), path: ROUTES.evals.paths[locale] },
    ]),
  ];
}

// Search results cut a title at about 60 characters, so the brand is only appended when the
// whole thing still fits. A guide title is written to fit on its own.
export const MAX_TITLE_LENGTH = 60;
const TITLE_SUFFIX = ' · Easy Render';

export const postTitle = (title: string): string =>
  title.length + TITLE_SUFFIX.length <= MAX_TITLE_LENGTH ? `${title}${TITLE_SUFFIX}` : title;

/** A guide's head. Its Open Graph image is the same picture as its BlogPosting image. */
export function postMetadata(post: BlogPost): Metadata {
  const image = schemaImage(post.body);
  return {
    ...pageMetadata({
      locale: post.locale,
      path: post.path,
      title: postTitle(post.title),
      description: post.description,
      alternates: postLivePaths(post.group),
      type: 'article',
      publishedTime: post.date,
      modifiedTime: modifiedDate(post),
      ...(image
        ? { image: image.src, imageSize: { width: image.width, height: image.height } }
        : {}),
    }),
    authors: [{ name: post.author.name, ...(post.author.url ? { url: post.author.url } : {}) }],
  };
}

/**
 * Organization, the BlogPosting, its breadcrumb and, when the guide has a FAQ section, a FAQPage
 * built from the same visible questions. Everything is cross-referenced by @id.
 */
export async function postGraph(post: BlogPost) {
  const t = await getTranslations({ locale: post.locale, namespace: 'Blog' });
  const image = schemaImage(post.body);
  return [
    organization(),
    article({ ...post, ...(image ? { image } : {}) }),
    breadcrumbList([
      { name: t('breadcrumb.home'), path: ROUTES.home.paths[post.locale] },
      { name: t('index.title'), path: ROUTES.blog.paths[post.locale] },
      { name: post.title, path: post.path },
    ]),
    ...(post.faq.length ? [faqPage(post.faq, `${absoluteUrl(post.path)}#faq`)] : []),
  ];
}

/** The comparisons hub of one language. */
export async function compareIndexMetadata(locale: Locale = 'en'): Promise<Metadata> {
  const copy = COMPARE_INDEX[locale];
  return pageMetadata({
    locale,
    path: ROUTES.compare.paths[locale],
    title: postTitle(copy.title),
    description: copy.description,
    alternates: livePaths('compare'),
  });
}

export async function compareIndexGraph(locale: Locale = 'en') {
  const t = await getTranslations({ locale, namespace: 'Blog' });
  return [
    breadcrumbList([
      { name: t('breadcrumb.home'), path: ROUTES.home.paths[locale] },
      { name: t('comparisons.title'), path: ROUTES.compare.paths[locale] },
    ]),
  ];
}

/** One comparison page, with its illustration as the Open Graph image when present. */
export function comparePageMetadata(page: ComparePage): Metadata {
  const image = schemaImage(page.body);
  return pageMetadata({
    locale: page.locale,
    path: page.path,
    title: postTitle(page.title),
    description: page.description,
    alternates: compareLivePaths(page.group),
    type: 'article',
    modifiedTime: page.updated,
    ...(image ? { image: image.src, imageSize: { width: image.width, height: image.height } } : {}),
  });
}

export async function comparePageGraph(page: ComparePage) {
  const t = await getTranslations({ locale: page.locale, namespace: 'Blog' });
  return [
    breadcrumbList([
      { name: t('breadcrumb.home'), path: ROUTES.home.paths[page.locale] },
      { name: t('comparisons.title'), path: ROUTES.compare.paths[page.locale] },
      { name: page.title, path: page.path },
    ]),
    ...(page.faq.length ? [faqPage(page.faq, `${absoluteUrl(page.path)}#faq`)] : []),
  ];
}
