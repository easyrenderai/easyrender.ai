import type { Metadata } from 'next';
import { HomeView } from '@/components/home/home-view';
import { setPricingContext } from '@/lib/pricing';
import { JsonLd } from '@/lib/seo/jsonld';
import { homeGraph, homeMetadata } from '@/lib/seo/pages';

// The English home, at the root. It is the x-default of every hreflang group.
// Built once per pricing key: the key is the `key` route param, see p/[key]/layout.tsx.
export async function generateMetadata({ params }: PageProps<'/p/[key]'>): Promise<Metadata> {
  setPricingContext((await params).key);
  return homeMetadata('en');
}

export default async function HomePage({ params }: PageProps<'/p/[key]'>) {
  setPricingContext((await params).key);
  return (
    <>
      <JsonLd graph={await homeGraph('en')} />
      <HomeView />
    </>
  );
}
