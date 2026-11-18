import { getLocale, getTranslations } from 'next-intl/server';
import { HomeHero } from '@/components/home/home-hero';
import { HomeIntegrations } from '@/components/home/home-integrations';
import { HomeIntro } from '@/components/home/home-intro';
import { HomeJourney } from '@/components/home/home-journey';
import { Faq, Pricing } from '@/components/landing';
import { PromptBar } from '@/components/prompt-bar';
import { ResourceLinks } from '@/components/resource-links';
import { StudioIndustries } from '@/components/studio/industries';
import { StudioPipeline } from '@/components/studio/pipeline';
import { StudioClosing, StudioCompatibility } from '@/components/studio/proof';
import { StudioShelf } from '@/components/studio/shelf';
import { StudioShell } from '@/components/studio/shell';
import { StudioTools } from '@/components/studio/tools';
import type { Locale } from '@/i18n/config';
import { currentUser } from '@/lib/actor';
import { isPublished, ROUTES } from '@/lib/seo/routes';

// The home, shared by every language: / is English, /es and the other prefixes render the same
// sections from their own messages. One component means the two homes cannot drift apart in
// structure, only in words.
export async function HomeView() {
  const [user, t, cta, locale] = await Promise.all([
    currentUser().catch(() => null),
    getTranslations('Home'),
    getTranslations('Studio.cta'),
    getLocale(),
  ]);
  const storeLocale = isPublished('ecommerce', locale as Locale) ? (locale as Locale) : 'en';

  return (
    <StudioShell>
      <HomeHero upload={<PromptBar signedIn={Boolean(user)} compact />} />
      <StudioCompatibility />
      <StudioPipeline />
      <HomeJourney />
      <HomeIntro />

      <StudioIndustries storeHref={ROUTES.ecommerce.paths[storeLocale]} storeLocale={storeLocale} />
      <StudioTools />

      <HomeIntegrations />

      <Pricing />
      <Faq />
      <ResourceLinks locale={locale as Locale} context="home" />
      <StudioClosing title={cta('title')} label={t('intro.primaryCta')} href="#try" />
      <StudioShelf />
    </StudioShell>
  );
}
