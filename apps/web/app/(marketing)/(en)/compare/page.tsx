import type { Metadata } from 'next';
import { CompareIndexView } from '@/components/compare/compare-index-view';
import { JsonLd } from '@/lib/seo/jsonld';
import { compareIndexGraph, compareIndexMetadata } from '@/lib/seo/pages';

// The English comparisons hub. Published and indexable (Jorge, 11-nov-2026).
export const generateMetadata = (): Promise<Metadata> => compareIndexMetadata('en');

export default async function CompareIndexPage() {
  return (
    <>
      <JsonLd graph={await compareIndexGraph('en')} />
      <CompareIndexView locale="en" />
    </>
  );
}
