import type { Metadata } from 'next';
import { ConverterView } from '@/components/viewer/converter-view';
import { JsonLd } from '@/lib/seo/jsonld';
import { converterGraph, converterMetadata } from '@/lib/seo/pages';

// The English 3D converter. Its Spanish twin is served by app/[lang]/[...path].
export const generateMetadata = (): Promise<Metadata> => converterMetadata('en');

export default async function ConverterPage() {
  return (
    <>
      <JsonLd graph={await converterGraph('en')} />
      <ConverterView locale="en" />
    </>
  );
}
