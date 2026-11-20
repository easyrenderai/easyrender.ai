import type { Metadata } from 'next';
import { PricingView } from '@/components/pricing/pricing-view';
import { setPricingContext } from '@/lib/pricing';
import { JsonLd } from '@/lib/seo/jsonld';
import { pricingGraph, pricingMetadata } from '@/lib/seo/pages';

// The English pricing page. Its Spanish twin is served by app/[lang]/[...path]. Plans are bought
// on /credits, behind sign-up; this page is the one that is public, indexed and linked.
// Built once per pricing key: the key is the `key` route param, see p/[key]/layout.tsx.
export async function generateMetadata({
  params,
}: PageProps<'/p/[key]/pricing'>): Promise<Metadata> {
  setPricingContext((await params).key);
  return pricingMetadata('en');
}

export default async function PricingPage({ params }: PageProps<'/p/[key]/pricing'>) {
  setPricingContext((await params).key);
  return (
    <>
      <JsonLd graph={await pricingGraph('en')} />
      <PricingView locale="en" />
    </>
  );
}
