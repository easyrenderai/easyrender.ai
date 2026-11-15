import { ENTERPRISE_BOOKING_URL } from '@easyrender/harness';
import { getLocale, getTranslations } from 'next-intl/server';
import { HomeIntegrations } from '@/components/home/home-integrations';
import { HomeIntro } from '@/components/home/home-intro';
import { Faq, Pricing, Section } from '@/components/landing';
import { PromptBar } from '@/components/prompt-bar';
import { ResourceLinks } from '@/components/resource-links';
import { StudioHero } from '@/components/studio/hero';
import { StudioIndustries } from '@/components/studio/industries';
import { StudioPipeline } from '@/components/studio/pipeline';
import { StudioClosing, StudioCompatibility, StudioProof } from '@/components/studio/proof';
import { StudioShelf } from '@/components/studio/shelf';
import { StudioShell } from '@/components/studio/shell';
import { StudioTools } from '@/components/studio/tools';
import { StudioWheel } from '@/components/studio/wheel';
import type { Locale } from '@/i18n/config';
import { currentUser } from '@/lib/actor';

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

  return (
    <StudioShell>
      <StudioHero ctaHref="#try" />
      <StudioCompatibility />
      <HomeIntro />
      <StudioPipeline />

      <Section id="try" title={t('try.title')} description={t('try.description')} narrow>
        <div className="sec__column">
          <PromptBar signedIn={Boolean(user)} />
        </div>
      </Section>

      <StudioIndustries salesHref={ENTERPRISE_BOOKING_URL} />
      <StudioTools />
      <StudioWheel />
      <StudioProof />

      <HomeIntegrations />

      <Pricing />
      <Faq />
      <ResourceLinks locale={locale as Locale} context="home" />
      <StudioClosing title={cta('title')} label={t('intro.primaryCta')} href="#try" />
      <StudioShelf />
    </StudioShell>
  );
}
