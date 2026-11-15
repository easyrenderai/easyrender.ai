import { afterEach, expect, it, vi } from 'vitest';
import {
  googlePurchasePayload,
  parseGoogleContext,
  sendGooglePurchase,
} from './google-measurement';

const checkout = { clientId: '123456.789012', sessionId: '1794567000' };
const purchase = {
  id: 'purchase-1',
  packId: 'payg:test',
  amountCents: 1000,
  currency: 'eur',
  updatedAt: new Date('2026-11-13T12:00:00Z'),
};
afterEach(() => vi.unstubAllEnvs());
it('accepts only a consented, valid browser measurement identity', () => {
  expect(parseGoogleContext(checkout, false)).toBeNull();
  expect(parseGoogleContext({ clientId: 'someone@example.com', sessionId: 'x' }, true)).toBeNull();
  expect(parseGoogleContext(checkout, true)).toEqual(checkout);
});
it('builds a purchase from confirmed money and a stable transaction ID, with advertising denied', () => {
  expect(googlePurchasePayload(purchase, checkout)).toMatchObject({
    client_id: checkout.clientId,
    timestamp_micros: purchase.updatedAt.getTime() * 1000,
    consent: { ad_user_data: 'DENIED', ad_personalization: 'DENIED' },
    events: [
      {
        name: 'purchase',
        params: {
          transaction_id: 'purchase-1',
          value: 10,
          currency: 'EUR',
          session_id: '1794567000',
        },
      },
    ],
  });
});
it('does not send outside production or without a configured secret', async () => {
  const fetcher = vi.fn();
  expect(await sendGooglePurchase(purchase, checkout, fetcher)).toBe('disabled');
  expect(fetcher).not.toHaveBeenCalled();
});
it('retries transport failures safely and never embeds the secret in returned errors', async () => {
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubEnv('GA_MEASUREMENT_ID', 'G-TEST000000');
  vi.stubEnv('GA_MEASUREMENT_API_SECRET', 'test-secret');
  const fetcher = vi
    .fn()
    .mockRejectedValue(new Error('https://google.invalid/?api_secret=test-secret'));
  expect(await sendGooglePurchase(purchase, checkout, fetcher)).toBe('retry');
  fetcher.mockResolvedValue(new Response(null, { status: 204 }));
  expect(await sendGooglePurchase(purchase, checkout, fetcher)).toBe('delivered');
  expect(JSON.parse(fetcher.mock.calls[1][1].body).events[0].params.transaction_id).toBe(
    'purchase-1',
  );
});

it('uses only recorded advertising permission and immutable paid time, never personalization', () => {
  const paidAt = new Date('2026-11-12T10:00:00Z');
  const result = googlePurchasePayload(
    { ...purchase, paidAt },
    { ...checkout, adMeasurementAllowed: true },
  );
  expect(result.consent).toEqual({ ad_user_data: 'GRANTED', ad_personalization: 'DENIED' });
  expect(result.timestamp_micros).toBe(paidAt.getTime() * 1000);
  expect(parseGoogleContext({ ...checkout, adMeasurementAllowed: true }, true)).toEqual(checkout);
});
