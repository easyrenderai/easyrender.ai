import { afterEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  currency: 'eur',
  variant: 'control',
  topup: { plan: 'pro', currency: 'eur', priceCents: 4600, creditsPerUnit: 5500 },
}));
vi.mock('./billing', () => ({
  buyerCurrency: async () => state.currency,
  getTopupPricing: async () => state.topup,
}));
vi.mock('./credits', () => ({ getBalance: async () => 123 }));
vi.mock('./pricing-experiment', () => ({ assignedPricing: async () => state.variant }));
const { getCreditQuote } = await import('./credit-quote');
afterEach(() => {
  state.currency = 'eur';
  state.variant = 'control';
});
it('quotes the buyer currency and subscriber topup contract with no misleading dollar fields', async () => {
  const result = await getCreditQuote({ userId: 'u1', geoCountry: 'US' });
  expect(result).toMatchObject({
    balance: 123,
    currency: 'eur',
    plans: { pay_as_you_go: { price_per_credit: 0.01 }, pro: { price_per_month: 46 } },
    topup: { plan: 'pro', price_cents: 4600, credits_per_unit: 5500 },
  });
  expect(result.plans.pay_as_you_go).not.toHaveProperty('usd_per_credit');
});
it('retains the old USD field for USD buyers and follows current experimental prices', async () => {
  state.currency = 'usd';
  state.variant = 'test';
  const result = await getCreditQuote({ userId: 'u1' });
  expect(result.plans.pay_as_you_go).toMatchObject({
    price_per_credit: 0.02,
    usd_per_credit: 0.02,
  });
  expect(result.plans).toHaveProperty('pro.price_per_month', 79);
});
