import { AppError, canAccess, getBalance, getRender, listEdits, toView } from '@easyrender/core';
import { Globe, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ModelView } from '@/components/model-view';
import { DATE_FORMAT, RenderDetail } from '@/components/render-detail';
import { RenderView } from '@/components/render-view';
import { Button } from '@/components/ui/button';
import { currentUser, resolveViewerActor } from '@/lib/actor';
import { noindexMetadata } from '@/lib/seo/metadata';
import { findShowcase } from '@/lib/showcase';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps<'/r/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const demo = findShowcase(id);
  const t = await getTranslations();
  const title = demo ? t(`Showcase.items.${demo.slug}.title`) : t('Render.metaTitle');
  return noindexMetadata(`${title} · easyrender`);
}

export default async function RenderPage({ params }: PageProps<'/r/[id]'>) {
  const { id } = await params;
  const demo = findShowcase(id);
  if (demo) {
    const [t, format, user] = await Promise.all([
      getTranslations(),
      getFormatter(),
      currentUser().catch(() => null),
    ]);
    return (
      <RenderDetail
        isInApp={Boolean(user)}
        title={t(`Showcase.items.${demo.slug}.title`)}
        prompt={t(`Showcase.items.${demo.slug}.prompt`)}
        badges={[t(`Showcase.categories.${demo.category}`), t('Render.example')]}
        viewer={<ModelView src={demo.model} name={demo.id} downloadUrl={null} />}
        input={demo.photo}
        angles={
          demo.angles ? (
            // biome-ignore lint/performance/noImgElement: static showcase image
            <img
              src={demo.angles}
              alt={t('Render.everyAngle')}
              className="w-full rounded-lg border bg-white"
            />
          ) : (
            <p className="flex aspect-[2/1] items-center justify-center rounded-lg border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
              {t('Render.noAngleSheet')}
            </p>
          )
        }
        meta={[
          { label: t('Render.meta.status'), value: t('Render.status.ready') },
          { label: t('Render.meta.dimensions'), value: demo.dimensions },
          { label: t('Render.meta.formats'), value: 'GLB · USDZ' },
          {
            label: t('Render.meta.visibility'),
            value: (
              <span className="inline-flex items-center gap-1.5">
                <Globe className="size-3.5" />
                {t('Render.public')}
              </span>
            ),
          },
          {
            label: t('Render.meta.created'),
            value: format.dateTime(new Date(demo.createdAt), DATE_FORMAT),
          },
        ]}
        actions={
          <Button className="w-full" asChild>
            <Link href="/#try">
              <Sparkles />
              {t('Render.makeYourOwn')}
            </Link>
          </Button>
        }
      />
    );
  }

  const actor = await resolveViewerActor();
  const render = await getRender(id, actor).catch((error) => {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  });
  const balance = actor.userId ? await getBalance(actor.userId) : 0;
  const isOwner = canAccess(render, actor);
  // The history is the owner's to read; a failed read leaves the tab empty rather than the page broken.
  const edits = isOwner && actor.userId ? await listEdits(id, actor).catch(() => []) : [];
  return (
    <RenderView
      initial={toView(render)}
      edits={edits}
      now={Date.now()}
      signedIn={Boolean(actor.userId)}
      balance={balance}
      owner={isOwner}
    />
  );
}
