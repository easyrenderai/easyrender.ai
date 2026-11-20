import { AppError, getRender, isListed } from '@easyrender/core';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArView } from '@/components/ar-view';
import { resolveViewerActor } from '@/lib/actor';
import { TABLE_EXAMPLE } from '@/lib/marketing-examples';
import { noindexMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Ar');
  return noindexMetadata(`${t('metaTitle')} · Easy Render`);
}

// The phone page behind a product's QR code. Opens for a store's link-shared models, for the
// gallery's public ones and for their owner.
export default async function ArPage({ params }: PageProps<'/ar/[id]'>) {
  const { id } = await params;
  const [t, actor] = await Promise.all([getTranslations('Ar'), resolveViewerActor()]);
  const render = await getRender(id, actor).catch((error) => {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  });
  const isTableExample = id === TABLE_EXAMPLE.id && isListed(render);
  const name = isTableExample
    ? (await getTranslations('Showcase'))('items.table.title')
    : render.name?.trim() || t('metaTitle');
  const isReady = render.status === 'ready' && Boolean(render.glbKey);
  if (!isReady) {
    return (
      <div className="mx-auto max-w-md space-y-2 px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">{t('notReadyTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('notReady')}</p>
      </div>
    );
  }
  return (
    <>
      <h1 className="mx-auto max-w-5xl px-4 pt-6 text-xl font-semibold sm:px-6 md:pt-10">
        {t('title', { name })}
      </h1>
      <ArView
        src={`/api/renders/${render.id}/model?v=${render.updatedAt.getTime()}`}
        name={name}
        qrUrl={`/api/renders/${render.id}/qr`}
      />
    </>
  );
}
