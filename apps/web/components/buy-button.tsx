'use client';

import type { PricingVariant } from '@easyrender/harness/pricing';
import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  captureBrowser,
  checkoutAttribution,
  gaEvent,
  googleCheckoutContext,
} from '@/lib/analytics/browser';

// Posts to a billing endpoint that answers with a Stripe URL, then follows it.
export function BuyButton({
  label,
  body,
  endpoint = '/api/checkout',
  variant = 'default',
  disabled = false,
  pricingVariant = 'control',
}: {
  label: string;
  body?: Record<string, unknown>;
  endpoint?: string;
  variant?: 'default' | 'outline';
  disabled?: boolean;
  pricingVariant?: PricingVariant;
}) {
  const t = useTranslations('BuyButton');
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="w-full space-y-2">
      <Button
        className="w-full"
        variant={variant}
        disabled={busy || disabled}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: { 'content-type': 'application/json', 'x-pricing-variant': pricingVariant },
              body: JSON.stringify({
                ...body,
                locale,
                ...(endpoint === '/api/checkout'
                  ? {
                      googleAnalytics: await googleCheckoutContext(),
                      attribution: checkoutAttribution(),
                    }
                  : {}),
              }),
            });
            const data = await response.json().catch(() => ({}));
            if (response.ok && data.url) {
              if (endpoint === '/api/checkout' && data.analytics) {
                const properties = data.analytics;
                captureBrowser('checkout_started', properties);
                gaEvent('begin_checkout', properties);
              }
              window.location.href = data.url;
              return;
            }
            setError(data.code === 'pricing_changed' ? t('pricingChanged') : t('failed'));
          } catch {
            setError(t('failed'));
          }
          setBusy(false);
        }}
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        {label}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
