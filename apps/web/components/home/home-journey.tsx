import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { SiteLink } from '@/components/site-link';

export async function HomeJourney() {
  const t = await getTranslations('Home.journey');
  return (
    <section className="sec" aria-labelledby="home-journey-title">
      <h2 id="home-journey-title" className="text-2xl font-medium tracking-tight">
        {t('title')}
      </h2>
      <ol className="mt-8 grid gap-8 md:grid-cols-3">
        {(['photo', 'model', 'use'] as const).map((step, index) => (
          <li key={step} className="space-y-3 border-t pt-5">
            <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
            <h3 className="text-lg font-medium">{t(`${step}.title`)}</h3>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              {t(`${step}.body`)}
            </p>
          </li>
        ))}
      </ol>
      <SiteLink
        href="/hub#ecosystem"
        className="mt-8 inline-flex items-center gap-2 text-sm underline underline-offset-4"
      >
        {t('hub')}
        <ArrowRight className="size-4" />
      </SiteLink>
    </section>
  );
}
