'use client';

import type { PricingVariant } from '@easyrender/harness/pricing';
import { PaygPicker } from '@/components/payg-picker';
import { useViewer } from '@/components/use-viewer';

/**
 * Top-ups at the rate of the viewer's own plan, for a subscriber only. The pricing page is the same
 * HTML for everyone, so the quote arrives with /api/viewer and the section is absent until then.
 */
export function SubscriberTopup({ title, variant }: { title: string; variant: PricingVariant }) {
  const topup = useViewer().data?.topup;
  if (!topup) return null;
  return (
    <section className="mx-auto mt-8 max-w-lg space-y-4" aria-labelledby="pricing-topups">
      <h2 id="pricing-topups" className="text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      <PaygPicker pricingVariant={variant} currency={topup.currency} rate={topup} />
    </section>
  );
}
