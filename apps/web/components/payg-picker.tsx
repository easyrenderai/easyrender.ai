'use client';

import {
  type BuildQuality,
  type ChargeCurrency,
  displayPricing,
  isValidPaygCredits,
  type PricingVariant,
  rendersFor,
  topupAmountCents,
  topupPricing,
} from '@easyrender/harness/pricing';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { BuyButton } from '@/components/buy-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { intlLocale } from '@/i18n/config';
import { cn } from '@/lib/utils';

export function PaygPicker({
  next,
  inlineQuality,
  pricingVariant = 'control',
  currency = 'usd',
  rate = topupPricing(null, pricingVariant, currency),
}: {
  next?: string | null;
  /** Set when the packs sit above a build button: checkout then returns to `next` with this quality. */
  inlineQuality?: BuildQuality;
  pricingVariant?: PricingVariant;
  currency?: ChargeCurrency;
  rate?: ReturnType<typeof topupPricing>;
}) {
  const { payg: PAYG } = displayPricing(pricingVariant, currency);
  const t = useTranslations('PaygPicker');
  const locale = intlLocale(useLocale());
  const format = (value: number, options?: Intl.NumberFormatOptions) =>
    new Intl.NumberFormat(locale, options).format(value);
  const usd = (credits: number) =>
    format(topupAmountCents(credits, rate) / 100, {
      style: 'currency',
      currency: rate.currency.toUpperCase(),
    });
  const [credits, setCredits] = useState(PAYG.min);
  const isValid = isValidPaygCredits(credits, pricingVariant);
  return (
    <div className="w-full space-y-3">
      {rate.plan && (
        <p className="text-sm text-muted-foreground">
          {t('planRate', {
            plan: displayPricing(rate.variant, rate.currency).plans[rate.plan].label,
          })}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {PAYG.presets.map((preset) => (
          <Button
            key={preset}
            type="button"
            variant="outline"
            aria-label={format(preset)}
            aria-describedby={`payg-price-${preset}`}
            aria-pressed={credits === preset}
            onClick={() => setCredits(preset)}
            className={cn(
              'rounded-md border px-2 py-1.5 text-sm tabular-nums transition-colors hover:bg-muted',
              credits === preset && 'border-primary bg-muted font-medium',
            )}
          >
            <span>{format(preset)}</span>
            <span id={`payg-price-${preset}`} className="text-muted-foreground">
              {usd(preset)}
            </span>
          </Button>
        ))}
      </div>
      <div className="space-y-1 text-sm">
        <label htmlFor="payg-credits" className="text-muted-foreground">
          {t('custom')}
        </label>
        <Input
          id="payg-credits"
          type="number"
          inputMode="numeric"
          min={PAYG.min}
          max={PAYG.max}
          step={1}
          value={Number.isFinite(credits) ? credits : ''}
          onChange={(event) => setCredits(Number.parseInt(event.target.value, 10))}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {isValid
          ? t('estimate', { price: usd(credits), count: rendersFor(credits) })
          : t('range', { min: format(PAYG.min), max: format(PAYG.max) })}
      </p>
      <BuyButton
        label={isValid ? t('buyAmount', { credits: format(credits) }) : t('buy')}
        body={{
          plan: 'payg',
          next,
          ...(inlineQuality ? { inline: true, quality: inlineQuality } : {}),
          credits,
          expectedAmountCents: topupAmountCents(credits, rate),
          expectedCurrency: rate.currency,
        }}
        pricingVariant={pricingVariant}
        disabled={!isValid}
      />
    </div>
  );
}
