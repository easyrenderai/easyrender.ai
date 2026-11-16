'use client';

import { ArrowRight, Box } from 'lucide-react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import type { CSSProperties } from 'react';
import { SiteLink as Link } from '@/components/site-link';
import { type ItemId, itemOf, photoUrl } from '@/lib/studio/catalog';
import { createFormat } from '@/lib/studio/format';
import { DemoCursor } from './icons';
import { useCatalogText } from './use-catalog-text';
import { useSection } from './use-section';

const CHAIR = itemOf('swivel-chair');
const FIRST_DROP = itemOf('barrel');

// Hub pieces in the interior render, pinned where they sit in the frame.
const PINS: { id: ItemId; x: string; y: string; left?: boolean }[] = [
  { id: 'bedside-table', x: '85%', y: '49%', left: true },
  { id: 'coffee-table', x: '42%', y: '77%' },
  { id: 'vase', x: '42%', y: '57%' },
  { id: 'lamp', x: '25.5%', y: '39%' },
];

// One model, three places it ends up: a shopper's room (AR), a studio's render, a game level.
export function StudioIndustries({ salesHref }: { salesHref: string }) {
  const t = useTranslations('Studio.industries');
  const colliders = useTranslations('Catalog.colliders');
  const locale = useLocale();
  const { names } = useCatalogText();
  const fmt = createFormat(locale);
  const searching = t('store.searching');
  const placed = t('store.placed');

  const ar = useSection<HTMLDivElement>(async (panel, scope) => {
    const { initAr } = await import('@/lib/studio/sections/ar');
    if (scope.alive) await initAr(panel, { scope, labels: { searching, placed } });
  }, locale);

  const arch = useSection<HTMLDivElement>(async (panel, scope) => {
    const { initArch } = await import('@/lib/studio/sections/arch');
    if (scope.alive) initArch(panel, { scope });
  }, locale);

  const game = useSection<HTMLDivElement>(async (panel, scope) => {
    const { initGame } = await import('@/lib/studio/sections/physics');
    if (!scope.alive) return;
    await initGame(panel, {
      scope,
      fmt: createFormat(locale),
      names,
      colliders: {
        box: colliders('box'),
        cylinder: colliders('cylinder'),
        hull: colliders('hull'),
      },
    });
  }, locale);

  return (
    <section className="sec sec--center" id="industries" aria-labelledby="studio-industries-title">
      <p className="statement statement--narrow reveal" id="studio-industries-title">
        <strong>{t('lead')}</strong>
        {t('body')}
      </p>

      <div className="trio">
        <article className="use">
          <div ref={ar} className="panel panel--ar" aria-hidden="true">
            <div className="phone">
              <div className="phone__screen">
                <div className="shop">
                  <div className="shop__bar">
                    <span>{t('store.domain')}</span>
                  </div>
                  {/* The phone screen is about 200px wide, so next/image serves a resized copy of
                      the 720px product shot instead of the original. */}
                  <Image src={photoUrl(CHAIR.id)} alt="" width={720} height={720} sizes="200px" />
                  <div className="shop__info">
                    <p className="shop__name">{names[CHAIR.id]}</p>
                    <p className="shop__meta">{t('store.meta')}</p>
                    <span className="shop__btn" data-er="button">
                      <Box />
                      {t('store.button')}
                    </span>
                  </div>
                </div>
                <div className="cam">
                  {/* No src in the markup: the camera view sits under the shop screen until the
                      demo runs, and the AR code sets the backdrop when the panel starts. */}
                  {/* biome-ignore lint/performance/noImgElement: camera backdrop the model is drawn over */}
                  <img data-er="backdrop" alt="" decoding="async" />
                  <div className="view" data-er="view" />
                  <div className="reticle" data-er="reticle" />
                  <span className="cam__pill" data-er="pill">
                    {searching}
                  </span>
                </div>
              </div>
            </div>
            <DemoCursor data-er="cursor" />
          </div>
          <div className="use__copy reveal">
            <p className="eyebrow">{t('store.eyebrow')}</p>
            <h3>{t('store.title')}</h3>
            <p>{t('store.body')}</p>
            <a className="link" href={salesHref} target="_blank" rel="noopener noreferrer">
              {t('store.link')} <ArrowRight />
            </a>
          </div>
        </article>

        <article className="use">
          <div ref={arch} className="panel panel--arch" aria-hidden="true">
            <video data-er="video" muted loop playsInline preload="none" />
            <ul className="pins">
              {PINS.map((pin) => (
                <li
                  key={pin.id}
                  data-er="pin"
                  className={pin.left ? 'is-left' : undefined}
                  style={{ '--x': pin.x, '--y': pin.y } as CSSProperties}
                >
                  <span>{names[pin.id]}</span>
                </li>
              ))}
            </ul>
            <div className="kelvin">
              <span className="kelvin__label">{t('interior.kelvin')}</span>
              <span className="kelvin__val">
                <b data-er="kelvin">2700</b> K
              </span>
              <span className="kelvin__track" data-er="track">
                <i />
              </span>
            </div>
          </div>
          <div className="use__copy reveal">
            <p className="eyebrow">{t('interior.eyebrow')}</p>
            <h3>{t('interior.title')}</h3>
            <p>{t('interior.body')}</p>
            <Link className="link" href="/hub">
              {t('interior.link')} <ArrowRight />
            </Link>
          </div>
        </article>

        <article className="use">
          <div ref={game} className="panel panel--game" aria-hidden="true">
            <div className="view" data-er="view" />
            <div className="inspector">
              <p className="inspector__head">
                <Box />
                <span data-er="name">{names[FIRST_DROP.id]}</span>
              </p>
              <dl>
                <div>
                  <dt>{t('games.rigidbody')}</dt>
                  <dd>{t('games.dynamic')}</dd>
                </div>
                <div>
                  <dt>{t('games.collider')}</dt>
                  <dd data-er="collider">{colliders(FIRST_DROP.collider)}</dd>
                </div>
                <div>
                  <dt>{t('games.friction')}</dt>
                  <dd data-er="friction">{fmt.fixed(FIRST_DROP.friction)}</dd>
                </div>
              </dl>
            </div>
            <span className="tag tag--corner">{t('games.live')}</span>
          </div>
          <div className="use__copy reveal">
            <p className="eyebrow">{t('games.eyebrow')}</p>
            <h3>{t('games.title')}</h3>
            <p>{t('games.body')}</p>
            <Link className="link" href="#connect">
              {t('games.link')} <ArrowRight />
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
