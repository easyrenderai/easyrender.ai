'use client';

import type { confirmedPurchase } from '@easyrender/core';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { reportPurchaseConversion } from '@/lib/analytics/browser';

type Confirmation = NonNullable<Awaited<ReturnType<typeof confirmedPurchase>>>;

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
    const controller = new AbortController();
    let attempts = 0;
    let confirmation = initial;
    let hasRefreshed = Boolean(initial);
    const poll = async () => {
      if (controller.signal.aborted || attempts++ >= 30) return;
      if (confirmation?.posthog && confirmation.transaction_id === sessionId) {
        // Consent and gtag may initialize after the checkout return. The event helper dedupes.
        reportPurchaseConversion(confirmation);
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
          if (!controller.signal.aborted && result?.transaction_id === sessionId) {
            confirmation = result;
            reportPurchaseConversion(result);
            if (!hasRefreshed) {
              hasRefreshed = true;
              router.refresh();
            }
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
