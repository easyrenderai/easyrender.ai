export type GoogleContext = { clientId: string; sessionId: string; adMeasurementAllowed?: boolean };
type Purchase = {
  id: string;
  packId: string;
  amountCents: number;
  currency: string;
  updatedAt: Date;
  paidAt?: Date | null;
};
export function isGoogleMeasurementConfigured() {
  return (
    process.env.VERCEL_ENV === 'production' &&
    /^G-[A-Z0-9]+$/.test(process.env.GA_MEASUREMENT_ID ?? '') &&
    Boolean(process.env.GA_MEASUREMENT_API_SECRET)
  );
}
export function parseGoogleContext(value: unknown, isAllowed: boolean): GoogleContext | null {
  if (!isAllowed || !value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  if (
    typeof input.clientId !== 'string' ||
    !/^\d{1,20}\.\d{1,20}$/.test(input.clientId) ||
    typeof input.sessionId !== 'string' ||
    !/^\d{1,20}$/.test(input.sessionId)
  )
    return null;
  return { clientId: input.clientId, sessionId: input.sessionId };
}
export function googlePurchasePayload(purchase: Purchase, checkout: GoogleContext) {
  return {
    client_id: checkout.clientId,
    timestamp_micros: (purchase.paidAt ?? purchase.updatedAt).getTime() * 1000,
    consent: {
      ad_user_data: checkout.adMeasurementAllowed === true ? 'GRANTED' : 'DENIED',
      ad_personalization: 'DENIED',
    },
    events: [
      {
        name: 'purchase',
        params: {
          transaction_id: purchase.id,
          value: purchase.amountCents / 100,
          currency: purchase.currency.toUpperCase(),
          session_id: checkout.sessionId,
          engagement_time_msec: 1,
          items: [{ item_id: purchase.packId, quantity: 1, price: purchase.amountCents / 100 }],
        },
      },
    ],
  };
}
export async function sendGooglePurchase(
  purchase: Purchase,
  checkout: GoogleContext,
  fetcher: typeof fetch = fetch,
) {
  if (!isGoogleMeasurementConfigured()) return 'disabled';
  const query = new URLSearchParams({
    measurement_id: process.env.GA_MEASUREMENT_ID ?? '',
    api_secret: process.env.GA_MEASUREMENT_API_SECRET ?? '',
  });
  try {
    const response = await fetcher(`https://region1.google-analytics.com/mp/collect?${query}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(googlePurchasePayload(purchase, checkout)),
      signal: AbortSignal.timeout(5000),
    });
    // A 2xx confirms transport only, not validation/attribution in GA4. Validate the payload separately.
    return response.ok ? 'delivered' : 'retry';
  } catch {
    return 'retry';
  } // Never log request URLs: they contain the Measurement Protocol secret.
}
