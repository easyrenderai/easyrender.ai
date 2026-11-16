import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { GalleryGrid } from '@/components/gallery-grid';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/config';
import { getGallery } from '@/lib/gallery';
import { noindexMetadata } from '@/lib/seo/metadata';
import { ROUTES } from '@/lib/seo/routes';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Explore');
  return noindexMetadata(t('metaTitle'));
}

export default async function ExplorePage() {
  const [items, t] = await Promise.all([getGallery(48), getTranslations('Explore')]);
  const nextT = await getTranslations('LandingIntent');
  const locale = (await getLocale()) as Locale;
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-12 sm:px-6">
      <div className="space-y-3">
        <Badge variant="outline">{t('eyebrow')}</Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t('title')}</h1>
        <p className="text-lg text-muted-foreground">{t('description')}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-5">
        <p className="max-w-xl text-sm text-muted-foreground">{nextT('galleryBody')}</p>
        <Button asChild>
          <Link href={`${ROUTES.home.paths[locale]}#try`}>{nextT('create')}</Link>
        </Button>
      </div>
      <GalleryGrid items={items} />
    </div>
  );
}
