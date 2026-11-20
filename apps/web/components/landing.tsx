import { RENDER_CREDITS } from '@easyrender/harness';
import { ArrowRight, ChevronDownIcon } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { PlanCards } from '@/components/pricing/plan-cards';
import { PricingExposure } from '@/components/pricing-exposure';
import { SiteLink as Link } from '@/components/site-link';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/config';
import { FAQ_KEYS } from '@/lib/faq';
import { formatMoney } from '@/lib/price-format';
import { isPublished, ROUTES } from '@/lib/seo/routes';
import { cn } from '@/lib/utils';

// A home page section in the studio layout: a two-tone statement (title, then description in
// grey), an optional link on the right, and the content below. Rendered inside <StudioShell>.
export function Section({
  id,
  title,
  description,
  children,
  className,
  action,
  narrow = false,
}: {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  // Centres the statement in a narrower column.
  narrow?: boolean;
}) {
  return (
    <section id={id} className={cn('sec', narrow && 'sec--center', className)}>
      <div className={cn('sec__head', narrow && 'sec__head--narrow')}>
        <div className={cn('statement reveal', narrow && 'statement--narrow')}>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export async function Pricing() {
  const { currentPricing } = await import('@/lib/pricing');
  const pricing = await currentPricing();
  const [t, locale] = await Promise.all([getTranslations('Landing.pricing'), getLocale()]);
  const usd = (cents: number) =>
    formatMoney(locale, cents / 100, pricing.currency, {
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    });
  const pricingPath = isPublished('pricing', locale as Locale)
    ? ROUTES.pricing.paths[locale as Locale]
    : ROUTES.pricing.paths.en;

  return (
    <Section
      id="pricing"
      title={t('title')}
      description={t('description', {
        credits: RENDER_CREDITS,
        price: usd(RENDER_CREDITS * pricing.creditPrice * 100),
      })}
      action={
        <Link className="link" href={pricingPath}>
          {t('seeAll')} <ArrowRight />
        </Link>
      }
    >
      <PricingExposure variant={pricing.variant} currency={pricing.currency} />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button asChild>
          <Link href={`${ROUTES.home.paths[locale as Locale]}#try`}>{t('tryFree')}</Link>
        </Button>
        <p className="text-sm text-muted-foreground">{t('noCard')}</p>
      </div>
      <PlanCards />
    </Section>
  );
}

export type FaqItem = { question: string; answer: string };

/**
 * The home FAQ as plain strings, so the accordion and the FAQPage structured data are built from
 * one list and cannot drift apart.
 */
export async function faqItems(): Promise<FaqItem[]> {
  const { currentPricing } = await import('@/lib/pricing');
  const { creditPrice, currency } = await currentPricing();
  const [t, locale] = await Promise.all([getTranslations('Landing.faq'), getLocale()]);
  const usd = (value: number) => formatMoney(locale, value, currency);
  const price = usd(RENDER_CREDITS * creditPrice);
  const unit = usd(creditPrice);
  return FAQ_KEYS.map((key) => ({
    question: t(`items.${key}.q`),
    answer: t(`items.${key}.a`, { credits: RENDER_CREDITS, price, unit }),
  }));
}

// Native <details>, not the Radix accordion: Radix does not render a closed panel's content at
// all, so the answers were missing from the server HTML that search engines and AI crawlers read,
// and the FAQPage structured data described text the page did not show. <details> keeps every
// answer in the HTML, opens without JavaScript, and is still one click per question.
export async function Faq() {
  const [t, items] = await Promise.all([getTranslations('Landing.faq'), faqItems()]);
  return (
    <Section id="faq" title={t('title')} narrow>
      <div className="sec__column">
        {items.map((item) => (
          <details key={item.question} className="group border-b last:border-b-0">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-md py-4 text-left font-medium outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
              <h3 className="text-base font-medium">{item.question}</h3>
              <ChevronDownIcon className="pointer-events-none size-4 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
