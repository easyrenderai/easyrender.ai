import type { Metadata } from 'next';
import { EcommerceView } from '@/components/ecommerce/ecommerce-view';
import { setPricingContext } from '@/lib/pricing';
import { JsonLd } from '@/lib/seo/jsonld';
import { ecommerceGraph, ecommerceMetadata } from '@/lib/seo/pages';

// The English page for stores. Its twins in the other languages are served by p/[key]/[lang]/[...path].
// Built once per pricing key: the key is the `key` route param, see p/[key]/layout.tsx.
export async function generateMetadata({
  params,
}: PageProps<'/p/[key]/ecommerce'>): Promise<Metadata> {
  setPricingContext((await params).key);
  return ecommerceMetadata('en');
}

export default async function EcommercePage({ params }: PageProps<'/p/[key]/ecommerce'>) {
  setPricingContext((await params).key);
  return (
    <>
      <JsonLd graph={await ecommerceGraph('en')} />
      <EcommerceView locale="en" />
    </>
  );
}
