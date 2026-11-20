import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { HomeView } from '@/components/home/home-view';
import { isRoutableLocale } from '@/i18n/config';
import { setPricingContext } from '@/lib/pricing';
import { JsonLd } from '@/lib/seo/jsonld';
import { homeGraph, homeMetadata } from '@/lib/seo/pages';
import { isPublished } from '@/lib/seo/routes';

// The home of every other language: /es today, /de, /fr, /it and /pt as their copy is reviewed.
// Same sections as the English home, written natively rather than translated.
export async function generateMetadata({
  params,
}: PageProps<'/p/[key]/[lang]'>): Promise<Metadata> {
  const { key, lang } = await params;
  setPricingContext(key);
  if (isRoutableLocale(lang)) setRequestLocale(lang);
  return isRoutableLocale(lang) && isPublished('home', lang) ? homeMetadata(lang) : {};
}

export default async function LocaleHomePage({ params }: PageProps<'/p/[key]/[lang]'>) {
  const { key, lang } = await params;
  setPricingContext(key);
  if (isRoutableLocale(lang)) setRequestLocale(lang);
  if (!isRoutableLocale(lang) || !isPublished('home', lang)) notFound();
  return (
    <>
      <JsonLd graph={await homeGraph(lang)} />
      <HomeView />
    </>
  );
}
