import type { Metadata } from 'next';
import { ApiView } from '@/components/api-landing/api-view';
import { setPricingContext } from '@/lib/pricing';
import { JsonLd } from '@/lib/seo/jsonld';
import { apiGraph, apiMetadata } from '@/lib/seo/pages';

// Built once per pricing key: the key is the `key` route param, see p/[key]/layout.tsx.
export async function generateMetadata({
  params,
}: PageProps<'/p/[key]/image-to-3d-api'>): Promise<Metadata> {
  setPricingContext((await params).key);
  return apiMetadata('en');
}

export default async function ApiPage({ params }: PageProps<'/p/[key]/image-to-3d-api'>) {
  setPricingContext((await params).key);
  return (
    <>
      <JsonLd graph={await apiGraph('en')} />
      <ApiView locale="en" />
    </>
  );
}
