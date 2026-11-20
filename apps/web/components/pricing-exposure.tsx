'use client';
import type { ChargeCurrency, PricingVariant } from '@easyrender/harness/pricing';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useViewer } from '@/components/use-viewer';
import { observePricing, stopObservingPricing } from '@/lib/analytics/browser';

// A page the signed-in viewer was refreshed for already, so a mismatch that persists cannot loop.
const refreshed = new Set<string>();

/**
 * Marks the pricing block of a page for the experiment: the arm it shows, and the subject that joins
 * an exposure to a visitor. A marketing page is built per pricing key, and the key was picked at the
 * edge from the country and the anonymous id. A signed-in buyer's own key can differ (their last paid
 * currency, their stored arm): /api/viewer says so, and the page is fetched again for it.
 */
export function PricingExposure({
  variant,
  currency,
  subject,
}: {
  variant: PricingVariant;
  currency: ChargeCurrency;
  /** Only on pages that know the visitor on the server (Credits). Marketing pages get it from /api/viewer. */
  subject?: string | null;
}) {
  const marker = useRef<HTMLSpanElement>(null);
  const router = useRouter();
  const { data, isPending } = useViewer();
  const key = `${currency}.${variant}`;
  const isKnown = subject !== undefined || !isPending;
  // The arm is fixed by the page; the viewer may carry another one for this person.
  const shown = data?.pricing.key;
  // use-effect-audit: ignore IntersectionObserver that reports when the pricing block is seen, and a router refresh when the viewer's key differs from the page's
  useEffect(() => {
    if (shown && shown !== key && !refreshed.has(key)) {
      refreshed.add(key);
      router.refresh();
      return;
    }
    const element = marker.current;
    if (!element || !isKnown) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) observePricing(variant);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      stopObservingPricing();
    };
  }, [variant, key, shown, isKnown, router]);
  return (
    <span
      ref={marker}
      data-pricing-variant={variant}
      data-pricing-subject={subject ?? undefined}
      aria-hidden="true"
      className="block h-px"
    />
  );
}
