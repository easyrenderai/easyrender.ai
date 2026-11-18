import type { Metadata } from 'next';
import { ViewerView } from '@/components/viewer/viewer-view';
import { JsonLd } from '@/lib/seo/jsonld';
import { viewerGraph, viewerMetadata } from '@/lib/seo/pages';

// The English 3D viewer. Its Spanish twin is served by app/[lang]/[...path].
export const generateMetadata = (): Promise<Metadata> => viewerMetadata('en');

export default async function ViewerPage() {
  return (
    <>
      <JsonLd graph={await viewerGraph('en')} />
      <ViewerView locale="en" />
    </>
  );
}
