import type { Metadata } from 'next';
import { EvalsView } from '@/components/evals/evals-view';
import { JsonLd } from '@/lib/seo/jsonld';
import { evalsGraph, evalsMetadata } from '@/lib/seo/pages';

// The English evals page. Its Spanish twin is served by app/[lang]/[...path].
export const generateMetadata = (): Promise<Metadata> => evalsMetadata('en');

export default async function EvalsPage() {
  return (
    <>
      <JsonLd graph={await evalsGraph('en')} />
      <EvalsView locale="en" />
    </>
  );
}
