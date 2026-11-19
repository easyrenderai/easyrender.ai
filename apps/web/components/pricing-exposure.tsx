'use client';
import type { PricingVariant } from '@easyrender/harness/pricing';
import { useEffect, useRef } from 'react';
import { observePricing, stopObservingPricing } from '@/lib/analytics/browser';

export function PricingExposure({
  variant,
  subject,
}: {
  variant: PricingVariant;
  subject: string | null;
}) {
  const marker = useRef<HTMLSpanElement>(null);
  // use-effect-audit: ignore IntersectionObserver that reports when the pricing block is seen
  useEffect(() => {
    const element = marker.current;
    if (!element) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) observePricing(variant);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      stopObservingPricing();
    };
  }, [variant]);
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
