import {
  AppError,
  canAccess,
  getBalance,
  getRender,
  isListed,
  isModelExportEnabled,
  listEdits,
  toView,
} from '@easyrender/core';
import { isBuildQuality } from '@easyrender/harness/pricing';
import { Globe, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { AngleSheet } from '@/components/angle-sheet';
import { ModelView } from '@/components/model-view';
import { DATE_FORMAT, RenderDetail } from '@/components/render-detail';
import { RenderView } from '@/components/render-view';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/config';
import { currentUser, resolveViewerActor } from '@/lib/actor';
import { TABLE_EXAMPLE } from '@/lib/marketing-examples';
import { noindexMetadata } from '@/lib/seo/metadata';
import { ROUTES } from '@/lib/seo/routes';
import { absoluteUrl, SITE_NAME } from '@/lib/seo/site';
import { findShowcase } from '@/lib/showcase';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps<'/r/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const demo = findShowcase(id);
  const t = await getTranslations();
  let name: string;
  let image: string | undefined;
  if (demo) {
    name = t(`Showcase.items.${demo.slug}.title`);
    image = absoluteUrl(demo.photo);
  } else {
    const actor = await resolveViewerActor();
    const render = await getRender(id, actor).catch((error) => {
      if (error instanceof AppError && error.status === 404) notFound();
      throw error;
    });
    // Only gallery-public, finished models have social cards. Even an owner or a
    // link-sharing recipient must not turn a private name/image into public metadata.
    if (!isListed(render)) return noindexMetadata(`${t('Render.untitled')} · ${SITE_NAME}`);
    name =
      id === TABLE_EXAMPLE.id
        ? t('Showcase.items.table.title')
        : render.name?.trim() || t('Render.untitled');
    const previewKey = render.sheetKey || render.sourceKey;
    if (previewKey && !previewKey.startsWith('pending:')) {
      image = absoluteUrl(`/api/renders/${encodeURIComponent(id)}/preview`);
    }
  }
  const shortName = name.length > 46 ? `${name.slice(0, 45).trimEnd()}…` : name;
  const title = `${shortName} · ${SITE_NAME}`;
  return {
    ...noindexMetadata(title),
    openGraph: {
      title,
      siteName: SITE_NAME,
      type: 'website',
      url: absoluteUrl(`/r/${encodeURIComponent(id)}`),
      images: image ? [{ url: image, alt: name }] : [],
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      images: image ? [image] : [],
    },
  };
}

export default async function RenderPage({ params, searchParams }: PageProps<'/r/[id]'>) {
  const { id } = await params;
  const { quality } = await searchParams;
  const demo = findShowcase(id);
  if (demo) {
    const [t, format, user, locale] = await Promise.all([
      getTranslations(),
      getFormatter(),
      currentUser().catch(() => null),
      getLocale(),
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
            <AngleSheet src={demo.angles} />
          ) : (
            <p className="flex aspect-[2/1] items-center justify-center rounded-lg border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
              {t('Render.noAngleSheet')}
            </p>
          )
        }
        anglesUrl={demo.angles ?? null}
        meta={[
          { label: t('Render.meta.status'), value: t('Render.status.ready') },
          { label: t('Render.meta.dimensions'), value: demo.dimensions },
          { label: t('Render.meta.formats'), value: 'GLB' },
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
            <Link href={`${ROUTES.home.paths[locale as Locale]}#try`}>
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
  const isTableExample = id === TABLE_EXAMPLE.id && isListed(render);
  const initial = toView(render);
  if (isTableExample && !isOwner) {
    const t = await getTranslations('Showcase');
    initial.name = t('items.table.title');
  }
  // The history is the owner's to read; a failed read leaves the tab empty rather than the page broken.
  const edits = isOwner && actor.userId ? await listEdits(id, actor).catch(() => []) : [];
  return (
    <RenderView
      initial={initial}
      sampleDownload={isTableExample ? TABLE_EXAMPLE.model : undefined}
      edits={edits}
      now={Date.now()}
      signedIn={Boolean(actor.userId)}
      balance={balance}
      owner={isOwner}
      canExport={isModelExportEnabled()}
      initialQuality={typeof quality === 'string' && isBuildQuality(quality) ? quality : 'low'}
    />
  );
}
