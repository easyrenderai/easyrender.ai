import { getTranslations } from 'next-intl/server';
import { SiteLink as Link } from '@/components/site-link';
import { HeroStack } from '@/components/studio/hero-stack';
import { Button } from '@/components/ui/button';
import { TRY_HREF } from '@/lib/site-navigation';

// The top of the home: what the product does and the way into the test flow, next to one object read five ways
// (photo, mesh, depth, normals, render) that turns and can be dragged.
export async function HomeHero() {
  const t = await getTranslations('Home.motionHero');
  const tryIt = await getTranslations('Try');
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
          <Button size="lg" className="h-12 px-8 text-base" asChild>
            <Link href={TRY_HREF}>{tryIt('cta')}</Link>
          </Button>
        </div>
      </div>
      <HeroStack />
    </section>
  );
}
