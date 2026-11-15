import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CompareView } from '@/components/compare/compare-view';
import { getComparePage } from '@/lib/compare/pages';
import { JsonLd } from '@/lib/seo/jsonld';
import { comparePageGraph, comparePageMetadata } from '@/lib/seo/pages';

// An English comparison page, published and indexable (Jorge, 11-nov-2026): canonical and
// Open Graph in the head, FAQ structured data when the page has an accordion, and a place
// in the sitemap and llms.txt. The other languages are served from /[lang]/[...path].
export async function generateMetadata({
  params,
}: PageProps<'/compare/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const page = getComparePage(slug);
  return page ? comparePageMetadata(page) : {};
}

export default async function ComparePageRoute({ params }: PageProps<'/compare/[slug]'>) {
  const { slug } = await params;
  const page = getComparePage(slug);
  if (!page) notFound();
  return (
    <>
      <JsonLd graph={await comparePageGraph(page)} />
      <CompareView page={page} />
    </>
  );
}
