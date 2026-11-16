'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { SiteLink as Link } from '@/components/site-link';
import { itemOf } from '@/lib/studio/catalog';
import { createFormat } from '@/lib/studio/format';
import { TriMark } from './icons';
import { useCatalogText } from './use-catalog-text';
import { useSection } from './use-section';

const FIRST = itemOf('swivel-chair');

// The same object read five ways at once: input photo, mesh, normals, depth and render.
// All four live passes turn together, and dragging the stack turns them by hand.
type HeroCopy = { title: string; subtitle: string; cta: string; note: string };

export function StudioHero({
  ctaHref,
  copy,
  upload,
}: {
  ctaHref: string;
  copy?: HeroCopy;
  upload?: ReactNode;
}) {
  const t = useTranslations('Studio.hero');
  const locale = useLocale();
  const { names } = useCatalogText();
  const fmt = createFormat(locale);

  const ref = useSection<HTMLElement>(
    async (root, scope) => {
      const { initHero } = await import('@/lib/studio/sections/hero');
      if (scope.alive) await initHero(root, { scope, fmt: createFormat(locale), names });
    },
    locale,
    '0px',
    { idle: true },
  );

  return (
    <section
      ref={ref}
      className={upload ? 'hero hero--upload' : 'hero'}
      aria-labelledby="studio-hero-title"
    >
      <div className="hero__copy">
        <h1 id="studio-hero-title" className={upload ? 'hero__keyword' : undefined}>
          {copy?.title ?? t('title')}
        </h1>
        {upload && <p className="hero__benefit">{t('benefit')}</p>}
        <p className="hero__lead">{copy?.subtitle ?? t('subtitle')}</p>
        {upload && (
          <div id="try" className="hero__upload">
            {upload}
          </div>
        )}
      </div>

      <div className="stack" data-er="stack" role="img" aria-label={t('stackLabel')}>
        <figure className="card card--photo">
          {/* No src in the markup: the card is invisible until the 3D code fades the stack in, and
              that code sets the photo when it does (or when WebGL is missing), so the first paint
              does not download it. */}
          {/* biome-ignore lint/performance/noImgElement: swapped by the 3D code as the object changes */}
          <img data-er="photo" alt="" width={720} height={720} decoding="async" />
          <figcaption className="tag tag--ink">{t('photo')}</figcaption>
        </figure>
        <div className="card card--wire" data-er="wire">
          <span className="tag">
            {t('mesh')} · <b data-er="tris">{fmt.int(FIRST.wireTris)}</b>
            <TriMark />
          </span>
        </div>
        <div className="card card--depth" data-er="depth">
          <span className="tag">{t('depth')}</span>
        </div>
        <div className="card card--normal" data-er="normal">
          <span className="tag">{t('normals')}</span>
        </div>
        <div className="card card--beauty" data-er="beauty">
          <span className="tag">{t('render')}</span>
          <dl className="hud">
            <div>
              <dt>{t('element')}</dt>
              <dd data-er="name">{names[FIRST.id]}</dd>
            </div>
          </dl>
        </div>
        <p className="stack__hint" aria-hidden="true">
          {t('hint')}
        </p>
      </div>

      {!upload && (
        <div className="hero__cta">
          <Link className="btn btn--xl" href={ctaHref}>
            {copy?.cta ?? t('cta')}
          </Link>
          <p className="hero__note">{copy?.note ?? t('note')}</p>
        </div>
      )}
    </section>
  );
}
