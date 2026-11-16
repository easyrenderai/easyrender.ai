import { PUBLIC_PLAN_IDS, RENDER_CREDITS, rendersFor } from '@easyrender/harness';
import { ChevronDown } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { PaygPicker } from '@/components/payg-picker';
import { CatalogCalculator } from '@/components/pricing/catalog-calculator';
import { PlanCards } from '@/components/pricing/plan-cards';
import { PricingExposure } from '@/components/pricing-exposure';
import { SiteLink as Link } from '@/components/site-link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Locale } from '@/i18n/config';
import { formatCount, formatMoney } from '@/lib/price-format';
import { currentPricing, currentTopupPricing } from '@/lib/pricing';
import { ROUTES } from '@/lib/seo/routes';
import { FAQ_ITEM_KEYS } from './faq-keys';

/** Money in the visitor's language and currency: whole units without cents, the rest with two. */
function dollars(locale: Locale, currency: 'usd' | 'eur') {
  return (cents: number) =>
    formatMoney(locale, cents / 100, currency, {
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    });
}

/**
 * The pricing FAQ as plain strings, so the visible list and the FAQPage structured data are built
 * from one source. Every figure comes from the harness for the visitor's pricing variant.
 */
export async function pricingFaqItems(locale: Locale) {
  const [t, pricing] = await Promise.all([
    getTranslations({ locale, namespace: 'Pricing.faq' }),
    currentPricing(),
  ]);
  const usd = dollars(locale, pricing.currency);
  const { plans, payg, creditPrice, currency } = pricing;
  const values = {
    credits: RENDER_CREDITS,
    price: formatMoney(locale, RENDER_CREDITS * creditPrice, currency),
    unit: formatMoney(locale, creditPrice, currency),
    min: formatCount(locale, payg.min),
    minPrice: usd(payg.min * creditPrice * 100),
    plan: plans.pro.label,
    planCredits: formatCount(locale, plans.pro.monthlyCredits),
    planModels: rendersFor(plans.pro.monthlyCredits),
    planPrice: usd(plans.pro.priceCents),
  };
  return FAQ_ITEM_KEYS.map((key) => ({
    question: t(`items.${key}.q`),
    answer: t(`items.${key}.a`, values),
  }));
}

/**
 * The marketing pricing page of one language: every plan, a side-by-side table, how credits are
 * spent, and the questions buyers ask. Numbers come from the harness (and so follow the A/B
 * variant); the purchase itself happens on /credits, behind sign-up.
 */
export async function PricingView({ locale }: { locale: Locale }) {
  const [t, pricing, items, topup] = await Promise.all([
    getTranslations({ locale, namespace: 'Pricing' }),
    currentPricing(),
    pricingFaqItems(locale),
    currentTopupPricing(),
  ]);
  const tPlans = await getTranslations({ locale, namespace: 'Landing.pricing' });
  const usd = dollars(locale, pricing.currency);
  const { plans, payg, creditPrice, currency } = pricing;
  const price = formatMoney(locale, RENDER_CREDITS * creditPrice, currency);
  const perCredit = (value: number) =>
    formatMoney(locale, value, currency, { minimumFractionDigits: 2, maximumFractionDigits: 4 });

  const rows = [
    {
      key: 'payg',
      name: tPlans('payg.name'),
      price: t('compare.from', { value: usd(payg.min * creditPrice * 100) }),
      credits: t('compare.from', { value: formatCount(locale, payg.min) }),
      models: t('compare.from', { value: rendersFor(payg.min) }),
      unit: perCredit(creditPrice),
    },
    ...PUBLIC_PLAN_IDS.map((id) => ({
      key: id,
      name: plans[id].label,
      price: t('compare.perMonth', { value: usd(plans[id].priceCents) }),
      credits: formatCount(locale, plans[id].monthlyCredits),
      models: String(rendersFor(plans[id].monthlyCredits)),
      unit: perCredit(plans[id].priceCents / 100 / plans[id].monthlyCredits),
    })),
  ];

  const steps = [
    { key: 'preview', title: t('how.preview.title'), body: t('how.preview.body') },
    {
      key: 'build',
      title: t('how.build.title', { credits: RENDER_CREDITS }),
      body: t('how.build.body', { price }),
    },
    { key: 'refund', title: t('how.refund.title'), body: t('how.refund.body') },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PricingExposure variant={pricing.variant} subject={pricing.subject} />
      <header className="mx-auto max-w-2xl space-y-3 text-center">
        <Badge variant="outline">{t('eyebrow')}</Badge>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {t('title')}
        </h1>
        <p className="text-lg text-muted-foreground text-pretty">
          {t('description', { credits: RENDER_CREDITS, price })}
        </p>
        <p className="font-medium">
          {t('minimum', { price: usd(payg.min * creditPrice * 100), count: rendersFor(payg.min) })}
        </p>
        <Button size="lg" asChild>
          <Link href={`${ROUTES.home.paths[locale]}#try`}>{tPlans('tryFree')}</Link>
        </Button>
        <p className="text-sm text-muted-foreground">{tPlans('noCard')}</p>
      </header>

      <div id="plans" className="mt-12">
        <PlanCards />
        <p className="mt-4 text-center text-sm text-muted-foreground">{t('note')}</p>
      </div>

      <CatalogCalculator variant={pricing.variant} currency={currency} />
      <section
        className="mt-8 space-y-2 text-sm text-muted-foreground"
        aria-labelledby="purchase-terms"
      >
        <h2 id="purchase-terms" className="font-medium text-foreground">
          {t('conditions.title')}
        </h2>
        <p>{t('conditions.billing')}</p>
        <p>{t('conditions.rights')}</p>
        <p>{t('conditions.tax')}</p>
        <Link href={ROUTES.terms.paths[locale]} className="underline">
          {t('conditions.link')}
        </Link>
      </section>

      {topup.plan && (
        <section className="mx-auto mt-8 max-w-lg space-y-4" aria-labelledby="pricing-topups">
          <h2 id="pricing-topups" className="text-2xl font-semibold tracking-tight">
            {t('topUpTitle')}
          </h2>
          <PaygPicker pricingVariant={pricing.variant} currency={topup.currency} rate={topup} />
        </section>
      )}

      <section className="mt-16 space-y-4" aria-labelledby="pricing-compare">
        <div className="space-y-1">
          <h2 id="pricing-compare" className="text-2xl font-semibold tracking-tight">
            {t('compare.title')}
          </h2>
          <p className="max-w-2xl text-muted-foreground text-pretty">
            {t('compare.description', { unit: formatMoney(locale, creditPrice, currency) })}
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('compare.plan')}</TableHead>
              <TableHead className="text-right">{t('compare.price')}</TableHead>
              <TableHead className="text-right">{t('compare.credits')}</TableHead>
              <TableHead className="text-right">{t('compare.models')}</TableHead>
              <TableHead className="text-right">{t('compare.perCredit')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-right tabular-nums">{row.price}</TableCell>
                <TableCell className="text-right tabular-nums">{row.credits}</TableCell>
                <TableCell className="text-right tabular-nums">{row.models}</TableCell>
                <TableCell className="text-right tabular-nums">{row.unit}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="mt-16 space-y-4" aria-labelledby="pricing-how">
        <h2 id="pricing-how" className="text-2xl font-semibold tracking-tight">
          {t('how.title')}
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <Card key={step.key}>
              <CardHeader>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground tabular-nums">
                  {t('how.step', { number: index + 1 })}
                </p>
                <CardTitle className="text-lg">{step.title}</CardTitle>
                <CardDescription className="text-pretty">{step.body}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section id="faq" className="mx-auto mt-16 max-w-3xl space-y-2" aria-labelledby="pricing-faq">
        <h2 id="pricing-faq" className="text-2xl font-semibold tracking-tight">
          {t('faq.title')}
        </h2>
        {/* Native <details>, like the home FAQ: every answer is in the server HTML. */}
        <div>
          {items.map((item) => (
            <details key={item.question} className="group border-b last:border-b-0">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-md py-4 text-left font-medium outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                <h3 className="text-base font-medium">{item.question}</h3>
                <ChevronDown className="pointer-events-none size-4 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
