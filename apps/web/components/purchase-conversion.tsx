'use client';
import { useEffect } from 'react';
import { gaEvent } from '@/lib/analytics/browser';
export function PurchaseConversion() {
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const session = params.get('session_id');
    if (params.get('status') !== 'success' || !session) return;
    const controller = new AbortController();
    let attempts = 0;
    const poll = async () => {
      if (controller.signal.aborted || attempts++ >= 30) return;
      try {
        const response = await fetch(
          `/api/checkout/confirmed?session_id=${encodeURIComponent(session)}`,
          { cache: 'no-store', signal: controller.signal },
        );
        if (response.ok) {
          const result = await response.json();
          if (result?.transaction_id) {
            if (!result.server_managed) {
              const { server_managed: _managed, ...purchase } = result;
              gaEvent('purchase', purchase, purchase.transaction_id);
            }
            if (result.server_managed) return;
          }
        }
      } catch {
        /* Retry while the confirmed webhook arrives. */
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, 2000);
    };
    let timer = setTimeout(poll, 1000);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);
  return null;
}
