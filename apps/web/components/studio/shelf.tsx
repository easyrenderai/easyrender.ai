'use client';

import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { SiteLink as Link } from '@/components/site-link';
import { CATALOG } from '@/lib/studio/catalog';
import { SHELVES } from '@/lib/studio/shelves';
import { useSection } from './use-section';

// A carousel of hub categories. Each card is a real shot of its elements, rendered in the
// browser once the shelf scrolls near.
export function StudioShelf() {
  const t = useTranslations('Studio.shelf');
  const categories = useTranslations('Catalog.categories');
  const locale = useLocale();

  const ref = useSection<HTMLElement>(
    async (root, scope) => {
      const { initShelf } = await import('@/lib/studio/sections/shelf');
      if (!scope.alive) return;
      await initShelf(root, {
        scope,
        labels: { count: (current, total) => t('count', { current, total }) },
      });
    },
    locale,
    '1200px',
  );

  return (
    <section ref={ref} className="sec shelf" aria-labelledby="studio-shelf-title">
      <div className="shelf__head">
        <div>
          <p className="statement statement--lg reveal" id="studio-shelf-title">
            <strong>{t('lead')}</strong>
            {t('body')}
          </p>
          <Link className="link reveal" href="/hub">
            {t('link')} <ArrowRight />
          </Link>
        </div>
        <div className="shelf__nav">
          <span className="shelf__count" data-er="count" aria-live="polite">
            {t('count', { current: 1, total: SHELVES.length })}
          </span>
          <button type="button" data-er="prev" aria-label={t('previous')}>
            <ArrowLeft />
          </button>
          <button type="button" data-er="next" aria-label={t('next')}>
            <ArrowRight />
          </button>
        </div>
      </div>
      <ul className="shelf__track" data-er="track">
        {SHELVES.map(({ category }) => (
          <li key={category} className="shelf__item" data-er="card">
            <Link href={`/hub?category=${category}`}>
              <div className="shelf__thumb">
                {/* biome-ignore lint/performance/noImgElement: filled with a shot rendered in the browser */}
                <img data-er="shot" alt="" decoding="async" hidden />
                <span className="tag">
                  {t('elements', {
                    count: CATALOG.filter((item) => item.category === category).length,
                  })}
                </span>
              </div>
              <p className="shelf__label link">
                {categories(category)} <ArrowRight />
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
