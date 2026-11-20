import { AuthorView } from '@/components/author-view';
import { JsonLd } from '@/lib/seo/jsonld';
import { authorGraph, authorMetadata } from '@/lib/seo/pages';

export const generateMetadata = () => authorMetadata('en');

export default async function AuthorPage() {
  return (
    <>
      <JsonLd graph={await authorGraph('en')} />
      <AuthorView locale="en" />
    </>
  );
}
