import type { Metadata } from 'next';
import { BlogIndexView } from '@/components/blog/blog-index-view';
import { JsonLd } from '@/lib/seo/jsonld';
import { blogIndexGraph, blogIndexMetadata } from '@/lib/seo/pages';

// The English guides hub. Stays out of the index until it has guides to index.
export const generateMetadata = (): Promise<Metadata> => blogIndexMetadata('en');

export default async function LearnPage() {
  return (
    <>
      <JsonLd graph={await blogIndexGraph('en')} />
      <BlogIndexView locale="en" />
    </>
  );
}
