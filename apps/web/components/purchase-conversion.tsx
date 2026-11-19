'use client';

import type { confirmedPurchase } from '@easyrender/core';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { gaEvent } from '@/lib/analytics/browser';

type Confirmation = NonNullable<Awaited<ReturnType<typeof confirmedPurchase>>>;

function reportConversion(result: Confirmation) {
  if (result.server_managed) return;
  const { server_managed: _managed, issued_credits: _credits, ...purchase } = result;
  gaEvent('purchase', purchase, purchase.transaction_id);
}

export function PurchaseConversion({
  sessionId,
  initial,
}: {
  sessionId: string;
  initial: Confirmation | null;
}) {
  const router = useRouter();
  // use-effect-audit: ignore polls the external checkout confirmation and refreshes the credited balance
  useEffect(() => {
    if (initial?.server_managed) return;
    const controller = new AbortController();
    let attempts = 0;
    const poll = async () => {
      if (controller.signal.aborted || attempts++ >= 30) return;
      if (initial) {
        // Consent and gtag may initialize after the checkout return. The event helper dedupes.
        reportConversion(initial);
        if (!controller.signal.aborted) timer = setTimeout(poll, 2000);
        return;
      }
      try {
        const response = await fetch(
          `/api/checkout/confirmed?session_id=${encodeURIComponent(sessionId)}`,
          { cache: 'no-store', signal: controller.signal },
        );
        if (response.ok) {
          const result = (await response.json()) as Confirmation | null;
          if (result?.transaction_id) {
            router.refresh();
            return;
          }
        }
      } catch {
        // Retry while the confirmed webhook arrives.
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, 2000);
    };
    let timer = setTimeout(poll, 1000);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [initial, router, sessionId]);
  return null;
}
