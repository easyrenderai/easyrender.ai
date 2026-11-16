'use client';

import { ArrowRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { SiteLink as Link } from '@/components/site-link';
import { photoUrl } from '@/lib/studio/catalog';
import { useSection } from './use-section';

const STOPS = ['store', 'hub', 'studio', 'client'] as const;

// The flywheel behind the hub: a store's photo becomes a model, a studio uses it, the client
// buys the piece, and more stores join.
export function StudioWheel() {
  const t = useTranslations('Studio.wheel');
  const locale = useLocale();

  const ref = useSection<HTMLDivElement>(async (panel, scope) => {
    const { initWheel } = await import('@/lib/studio/sections/wheel');
    if (scope.alive) await initWheel(panel, { scope });
  }, locale);

  return (
    <section className="sec sec--center" id="hub" aria-labelledby="studio-wheel-title">
      <p className="statement statement--narrow reveal" id="studio-wheel-title">
        <strong>{t('lead')}</strong>
        {t('body')}
      </p>

      <div ref={ref} className="panel panel--wheel">
        <div className="wheel" data-er="wheel">
          <svg className="wheel__ring" viewBox="0 0 600 600" aria-hidden="true">
            <circle className="wheel__track" cx="300" cy="300" r="250" />
            <circle
              className="wheel__arc"
              data-er="arc"
              cx="300"
              cy="300"
              r="250"
              pathLength="100"
            />
            <circle className="wheel__dot" data-er="dot" r="5" />
          </svg>
          <div className="view" data-er="view" aria-hidden="true" />
          <figure className="wheel__photo" aria-hidden="true">
            {/* biome-ignore lint/performance/noImgElement: swapped by the 3D code on every lap */}
            <img
              data-er="photo"
              src={photoUrl('bedside-table')}
              alt=""
              width={720}
              height={720}
              loading="lazy"
              decoding="async"
            />
            <figcaption className="tag tag--ink">{t('photo')}</figcaption>
          </figure>
          <span className="wheel__chip" aria-hidden="true">
            {t('chip')}
          </span>
          <ol className="wheel__stops">
            {STOPS.map((stop, index) => (
              <li key={stop} data-er="stop">
                <span className="wheel__n">{index + 1}</span>
                <b>{t(`stops.${stop}.title`)}</b>
                <i>{t(`stops.${stop}.body`)}</i>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <Link className="link link--below reveal" href="/hub">
        {t('link')} <ArrowRight />
      </Link>
    </section>
  );
}
