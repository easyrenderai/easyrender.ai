import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { PromoVideo } from '@/components/blog/promo-video';
import { SiteLink as Link } from '@/components/site-link';
import { TABLE_EXAMPLE } from '@/lib/marketing-examples';

export async function HomeHero({ upload }: { upload: ReactNode }) {
  const t = await getTranslations('Home.motionHero');
  const hero = await getTranslations('Studio.hero');
  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      <div className="home-hero__copy">
        <h1 id="home-hero-title" className="home-hero__keyword">
          {hero('title')}
        </h1>
        <p className="home-hero__headline">{t('title')}</p>
        <p className="home-hero__lead">{t('description')}</p>
        <div id="try" className="home-hero__upload">
          {upload}
        </div>
      </div>
      <figure className="home-hero__motion">
        <PromoVideo
          src="/motion/hero.mp4"
          poster="/motion/hero.jpg"
          width={1000}
          height={800}
          label={t('label')}
          play={t('play')}
          pause={t('pause')}
        />
        <figcaption>
          <ol>
            {(['photo', 'angles', 'model'] as const).map((step, index) => (
              <li key={step}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                {t(step)}
              </li>
            ))}
          </ol>
          <Link href={`/r/${TABLE_EXAMPLE.id}`} className="home-hero__example">
            {t('example')}
          </Link>
        </figcaption>
      </figure>
    </section>
  );
}
