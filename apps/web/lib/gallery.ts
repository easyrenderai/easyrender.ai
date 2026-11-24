import 'server-only';
import { listPublicRenders } from '@easyrender/core';
import { getTranslations } from 'next-intl/server';
import { TABLE_EXAMPLE } from './marketing-examples';
import { SHOWCASE } from './showcase';

export type GalleryItem = {
  id: string;
  href: string;
  title: string;
  photo: string;
  model: string;
  label: string;
};

// Lead with a curated example, then show public gallery uploads.
export async function getGallery(size = 8): Promise<GalleryItem[]> {
  const renders = await (async () => listPublicRenders(size))().catch((error) => {
    console.error('gallery: could not list public renders', error);
    return [];
  });
  const t = await getTranslations('Showcase');
  const items: GalleryItem[] = renders.map((render) => ({
    id: render.id,
    href: `/r/${render.id}`,
    title:
      render.id === TABLE_EXAMPLE.id
        ? t('items.table.title')
        : render.name?.trim() || render.prompt?.trim() || t('untitled'),
    photo: `/api/renders/${render.id}/source`,
    model: `/api/renders/${render.id}/model?view=1`,
    label: t('model3d'),
  }));
  const demos = SHOWCASE.map((demo) => ({
    id: demo.id,
    href: `/r/${demo.id}`,
    title: t(`items.${demo.slug}.title`),
    photo: demo.photo,
    model: demo.model,
    label: t(`categories.${demo.category}`),
  }));
  const [lead, ...moreExamples] = demos;
  return [...(lead ? [lead] : []), ...items, ...moreExamples].slice(0, size);
}
