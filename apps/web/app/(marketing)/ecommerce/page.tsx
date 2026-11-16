import type { Metadata } from 'next';
import { EcommerceView } from '@/components/ecommerce/ecommerce-view';
import { JsonLd } from '@/lib/seo/jsonld';
import { ecommerceGraph, ecommerceMetadata } from '@/lib/seo/pages';

// The English page for stores. Its Spanish twin is served by app/[lang]/[...path].
export const generateMetadata = (): Promise<Metadata> => ecommerceMetadata('en');

export default async function EcommercePage() {
  return (
    <>
      <JsonLd graph={await ecommerceGraph('en')} />
      <EcommerceView locale="en" />
    </>
  );
}
