'use client';

import {
  type ChargeCurrency,
  displayPricing,
  type PricingVariant,
  RENDER_CREDITS,
} from '@easyrender/harness/pricing';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { SiteLink } from '@/components/site-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { catalogEstimate } from '@/lib/catalog-estimate';
import { formatCount, formatMoney } from '@/lib/price-format';

export function CatalogCalculator({
  variant,
  currency,
}: {
  variant: PricingVariant;
  currency: ChargeCurrency;
}) {
  const t = useTranslations('Pricing.calculator');
  const locale = useLocale();
  const [count, setCount] = useState('10');
  const pricing = displayPricing(variant, currency);
  const estimate = catalogEstimate(Number(count), pricing);
  const max = Math.floor(pricing.payg.max / RENDER_CREDITS);
  const money = (value: number) => formatMoney(locale, value, currency);
  return (
    <section
      className="mt-12 space-y-4 rounded-xl border bg-card p-6"
      aria-labelledby="catalog-estimate-title"
    >
      <h2 id="catalog-estimate-title" className="text-2xl font-semibold">
        {t('title')}
      </h2>
      <div className="max-w-xs space-y-2">
        <Label htmlFor="catalog-count">{t('count')}</Label>
        <Input
          id="catalog-count"
          type="number"
          inputMode="numeric"
          min={1}
          max={max}
          step={1}
          value={count}
          onChange={(event) => setCount(event.target.value)}
        />
      </div>
      <div aria-live="polite">
        {estimate ? (
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-muted-foreground">{t('consumption')}</dt>
              <dd className="text-2xl font-semibold">{money(estimate.consumption)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{t('purchase')}</dt>
              <dd className="text-2xl font-semibold">{money(estimate.purchase)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{t('remaining')}</dt>
              <dd className="text-2xl font-semibold">
                {formatCount(locale, estimate.remainingCredits)}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-destructive">{t('range', { max: formatCount(locale, max) })}</p>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{t('note')}</p>
      <Button variant="outline" asChild>
        <SiteLink href="#plans">{t('compare')}</SiteLink>
      </Button>
    </section>
  );
}
