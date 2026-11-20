import { PRICING_CONTEXT_KEYS } from '@easyrender/core/pricing-context';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ApiView } from '@/components/api-landing/api-view';
import { EcommerceView } from '@/components/ecommerce/ecommerce-view';
import { ModelsView } from '@/components/models/models-view';
import { PricingView } from '@/components/pricing/pricing-view';
import { isRoutableLocale, ROUTABLE_LOCALES } from '@/i18n/config';
import { localeStaticPaths, PRICED_KINDS, resolveLocalePath } from '@/lib/locale-match';
import { setPricingContext } from '@/lib/pricing';
import { JsonLd } from '@/lib/seo/jsonld';
import {
  apiGraph,
  apiMetadata,
  ecommerceGraph,
  ecommerceMetadata,
  modelsGraph,
  modelsMetadata,
  pricingGraph,
  pricingMetadata,
} from '@/lib/seo/pages';

// The pages below a language home that quote money, one set per pricing key. The same registry
// lookup as app/[lang]/[...path], which renders everything else and none of these.

export const revalidate = 3600;

export function generateStaticParams() {
  return PRICING_CONTEXT_KEYS.flatMap((key) =>
    ROUTABLE_LOCALES.filter((lang) => lang !== 'en').flatMap((lang) =>
      localeStaticPaths(lang, true).map((path) => ({ key, lang, path })),
    ),
  );
}

export async function generateMetadata({
  params,
}: PageProps<'/p/[key]/[lang]/[...path]'>): Promise<Metadata> {
  const { key, lang, path } = await params;
  setPricingContext(key);
  if (isRoutableLocale(lang)) setRequestLocale(lang);
  const match = resolveLocalePath(lang, path);
  if (match.kind === 'pricing') return pricingMetadata(match.locale);
  if (match.kind === 'api') return apiMetadata(match.locale);
  if (match.kind === 'ecommerce') return ecommerceMetadata(match.locale);
  if (match.kind === 'models') return modelsMetadata(match.locale);
  return {};
}

export default async function PricedLocalePage({ params }: PageProps<'/p/[key]/[lang]/[...path]'>) {
  const { key, lang, path } = await params;
  if (isRoutableLocale(lang)) setRequestLocale(lang);
  setPricingContext(key);
  const match = resolveLocalePath(lang, path);
  if (!PRICED_KINDS.has(match.kind)) notFound();
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
  if (match.kind === 'models') {
    return (
      <>
        <JsonLd graph={await modelsGraph(match.locale)} />
        <ModelsView locale={match.locale} />
      </>
    );
  }
  notFound();
}
