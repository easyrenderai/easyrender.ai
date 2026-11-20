import type { Metadata } from 'next';
import { ModelsView } from '@/components/models/models-view';
import { setPricingContext } from '@/lib/pricing';
import { JsonLd } from '@/lib/seo/jsonld';
import { modelsGraph, modelsMetadata } from '@/lib/seo/pages';

// The English models page. Its twins in the other languages are served by p/[key]/[lang]/[...path].
// Built once per pricing key: the key is the `key` route param, see p/[key]/layout.tsx.
export async function generateMetadata({
  params,
}: PageProps<'/p/[key]/models'>): Promise<Metadata> {
  setPricingContext((await params).key);
  return modelsMetadata('en');
}

export default async function ModelsPage({ params }: PageProps<'/p/[key]/models'>) {
  setPricingContext((await params).key);
  return (
    <>
      <JsonLd graph={await modelsGraph('en')} />
      <ModelsView locale="en" />
    </>
  );
}
