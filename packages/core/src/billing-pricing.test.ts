import { type PricingVariant, pricingFor, unitAmountCents } from '@easyrender/harness';
import type Stripe from 'stripe';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  createCheckout,
  parseCheckout,
  planFromInvoice,
  validateCheckoutPrice,
  variantFromInvoice,
} from './billing';

const state = vi.hoisted(() => ({
  variant: 'test' as PricingVariant,
  session: vi.fn(),
  price: vi.fn(),
  purchase: vi.fn(),
  customer: vi.fn(),
  customerId: null as string | null,
  lastCurrency: null as string | null,
  subscriptionStatus: null as string | null,
  subscription: vi.fn(),
}));
vi.mock('./pricing-experiment', async (original) => ({
  ...(await original<typeof import('./pricing-experiment')>()),
  assignedPricing: async () => state.variant,
}));
vi.mock('@easyrender/db', () => ({
  db: () => ({
    user: {
      findUnique: async () => ({
        email: 'qa@example.invalid',
        stripeCustomerId: state.customerId,
        subscriptionStatus: state.subscriptionStatus,
        subscriptionPlan: state.subscriptionStatus ? 'pro' : null,
        subscriptionId: state.subscriptionStatus ? 'sub_existing' : null,
      }),
    },
    purchase: {
      create: state.purchase,
      findFirst: async () => (state.lastCurrency ? { currency: state.lastCurrency } : null),
    },
  }),
}));
vi.mock('stripe', () => ({
  default: class {
    prices = { retrieve: state.price };
    subscriptions = { retrieve: state.subscription };
    customers = { retrieve: state.customer };
    checkout = { sessions: { create: state.session } };
  },
}));
const price = (plan: 'payg' | 'pro', variant: PricingVariant = 'test') =>
  ({
    id: `price_${plan}_${variant}`,
    active: true,
    currency: 'usd',
    currency_options: { eur: { unit_amount: unitAmountCents(plan, variant, 'eur') } },
    billing_scheme: 'per_unit',
    transform_quantity: null,
    unit_amount:
      plan === 'payg'
        ? pricingFor(variant).creditUsd * 100
        : pricingFor(variant).plans[plan].priceCents,
    recurring:
      plan === 'payg' ? null : { interval: 'month', interval_count: 1, usage_type: 'licensed' },
  }) as unknown as Stripe.Price;
beforeEach(() => {
  vi.clearAllMocks();
  state.variant = 'test';
  state.customerId = null;
  state.lastCurrency = null;
  state.subscriptionStatus = null;
  state.subscription.mockResolvedValue({
    status: 'active',
    customer: 'cus_existing',
    currency: 'usd',
    items: { data: [{ price: { id: 'price_pro_control' } }] },
  });
  vi.stubEnv('STRIPE_PRICE_PAYG', 'price_payg_control');
  vi.stubEnv('STRIPE_PRICE_SCALE', 'price_scale_control');
  vi.stubEnv('STRIPE_PRICE_SCALE_TEST', 'price_scale_test');
  vi.stubEnv('STRIPE_PRICE_CREATOR_TEST', 'price_creator_test');
  vi.stubEnv('STRIPE_PRICE_CREATOR', 'price_creator_control');
  vi.stubEnv('STRIPE_SECRET_KEY', 'local-only');
  vi.stubEnv('STRIPE_PRICE_PAYG_TEST', 'price_payg_test');
  vi.stubEnv('STRIPE_PRICE_PRO_TEST', 'price_pro_test');
  vi.stubEnv('STRIPE_PRICE_PRO', 'price_pro_control');
  state.session.mockResolvedValue({ id: 'cs_local', url: 'https://checkout.stripe.com/local' });
  state.price.mockResolvedValue(price('payg'));
});
afterEach(() => vi.unstubAllEnvs());
it('preserves the render on both checkout return URLs', async () => {
  await createCheckout('user', { plan: 'payg', credits: 500, next: '/r/render_123' });
  const checkout = state.session.mock.calls[0][0];
  expect(new URL(checkout.success_url).searchParams.get('next')).toBe('/r/render_123');
  expect(new URL(checkout.cancel_url).searchParams.get('next')).toBe('/r/render_123');
});
it.each([
  '//evil.example',
  '/\\evil.example',
  'https://evil.example',
  '/r/../account',
  '/r/test?next=evil',
])('never forwards an unsafe checkout destination: %s', async (next) => {
  await createCheckout('user', { plan: 'payg', credits: 500, next });
  const checkout = state.session.mock.calls[0][0];
  expect(new URL(checkout.success_url).searchParams.has('next')).toBe(false);
});
it('ignores forged prices and variants, charges the assigned price and snapshots the credits', async () => {
  const body = {
    plan: 'payg',
    credits: 500,
    price: 1,
    amountCents: 1,
    pricing_variant: 'control',
    monthlyCredits: 999999,
  };
  expect(await createCheckout('user', body)).toBe('https://checkout.stripe.com/local');
  expect(state.session.mock.calls[0][0]).toMatchObject({
    line_items: [{ price: 'price_payg_test', quantity: 500 }],
    metadata: { pricing_variant: 'test', pricing_flag: 'pricing-test-2026-11' },
  });
  expect(state.purchase.mock.calls[0][0].data).toMatchObject({
    packId: 'payg:test',
    credits: 500,
    amountCents: 1000,
  });
});
it('rejects stale displayed prices instead of silently charging a different amount', async () => {
  await expect(
    createCheckout('user', { plan: 'payg', credits: 500 }, { expectedVariant: 'control' }),
  ).rejects.toMatchObject({ code: 'pricing_changed' });
  expect(state.session).not.toHaveBeenCalled();
});
it('validates quantity again at the authoritative checkout entry point', async () => {
  for (const credits of [499, 100001, 500.5, NaN, Infinity, undefined]) {
    await expect(createCheckout('user', { plan: 'payg', credits })).rejects.toMatchObject({
      code: 'bad_amount',
    });
  }
  expect(state.session).not.toHaveBeenCalled();
  expect(parseCheckout({ plan: 'pro', credits: 999999 }, 'test')).toEqual({ plan: 'pro' });
});
it('snapshots subscription metadata and validates the Stripe monthly price', async () => {
  state.price.mockResolvedValue(price('pro'));
  await createCheckout('user', { plan: 'pro' });
  expect(state.session.mock.calls[0][0]).toMatchObject({
    mode: 'subscription',
    line_items: [{ price: 'price_pro_test', quantity: 1 }],
    metadata: { plan: 'pro', pricing_variant: 'test' },
    subscription_data: { metadata: { plan: 'pro', pricing_variant: 'test' } },
  });
});
it('fails closed for a misconfigured Stripe amount, currency, billing scheme or interval', async () => {
  for (const patch of [
    { unit_amount: 1 },
    { currency: 'eur' },
    { active: false },
    { billing_scheme: 'tiered' },
    { transform_quantity: { divide_by: 2 } },
  ]) {
    state.price.mockResolvedValue({ ...price('payg'), ...patch });
    await expect(createCheckout('user', { plan: 'payg', credits: 500 })).rejects.toMatchObject({
      code: 'price_mismatch',
    });
  }
  expect(() =>
    validateCheckoutPrice(
      { ...price('pro'), recurring: { interval: 'year' } } as Stripe.Price,
      'pro',
      'test',
    ),
  ).toThrow();
  expect(state.session).not.toHaveBeenCalled();
});
it('uses the actual invoice price after portal changes, even when the flag is off', () => {
  state.variant = 'control';
  const invoice = (id: string) =>
    ({
      parent: { subscription_details: { metadata: { plan: 'creator', pricing_variant: 'test' } } },
      lines: {
        data: [
          {
            parent: { subscription_item_details: { proration: false } },
            pricing: { price_details: { price: id } },
          },
        ],
      },
    }) as unknown as Stripe.Invoice;
  expect(variantFromInvoice(invoice('price_creator_test'))).toBe('test');
  expect(variantFromInvoice(invoice('price_creator_control'))).toBe('control');
  expect(planFromInvoice(invoice('price_creator_test'))).toBe('creator');
});

it('charges a euro-area buyer the fixed EUR price', async () => {
  await createCheckout('user', { plan: 'payg', credits: 500 }, { country: 'ES' });
  expect(state.session.mock.calls[0][0]).toMatchObject({
    currency: 'eur',
    adaptive_pricing: { enabled: false },
    line_items: [{ price: 'price_payg_test', quantity: 500 }],
  });
  expect(state.purchase.mock.calls[0][0].data).toMatchObject({
    credits: 500,
    amountCents: 1000,
    currency: 'eur',
  });
});
it('keeps USD for other countries, and for everyone with the EUR kill switch on', async () => {
  await createCheckout('user', { plan: 'payg', credits: 500 }, { country: 'US' });
  vi.stubEnv('EUR_CHECKOUT_DISABLED', '1');
  await createCheckout('user', { plan: 'payg', credits: 500 }, { country: 'ES' });
  for (const [call] of state.session.mock.calls) expect(call).toMatchObject({ currency: 'usd' });
  for (const [call] of state.purchase.mock.calls) expect(call.data.currency).toBe('usd');
});
it('refuses EUR when the Stripe price carries a different EUR amount', async () => {
  state.price.mockResolvedValue({
    ...price('payg'),
    currency_options: { eur: { unit_amount: 3 } },
  });
  await expect(
    createCheckout('user', { plan: 'payg', credits: 500 }, { country: 'DE' }),
  ).rejects.toMatchObject({ code: 'price_mismatch' });
  state.price.mockResolvedValue({ ...price('payg'), currency_options: undefined });
  await expect(
    createCheckout('user', { plan: 'payg', credits: 500 }, { country: 'DE' }),
  ).rejects.toMatchObject({ code: 'price_mismatch' });
  expect(state.session).not.toHaveBeenCalled();
});
it('keeps a returning customer in the currency Stripe already locked them to', async () => {
  state.customerId = 'cus_1';
  state.customer.mockResolvedValue({ id: 'cus_1', currency: 'usd' });
  await createCheckout('user', { plan: 'payg', credits: 500 }, { country: 'FR' });
  expect(state.session.mock.calls[0][0]).toMatchObject({ currency: 'usd' });
  state.customer.mockResolvedValue({ id: 'cus_1', currency: 'eur' });
  await createCheckout('user', { plan: 'payg', credits: 500 }, { country: 'US' });
  expect(state.session.mock.calls[1][0]).toMatchObject({ currency: 'eur' });
});
it('returns the server-selected checkout amount and currency for analytics', async () => {
  const { createCheckoutDetails } = await import('./billing');
  expect(
    await createCheckoutDetails('user', { plan: 'payg', credits: 500 }, { country: 'ES' }),
  ).toMatchObject({
    url: 'https://checkout.stripe.com/local',
    sessionId: 'cs_local',
    analytics: {
      currency: 'EUR',
      value: 10,
      pricing_variant: 'test',
      items: [{ item_id: 'payg', quantity: 500 }],
    },
  });
});
it('keeps a returning buyer in the currency of their last paid order', async () => {
  state.lastCurrency = 'usd';
  await createCheckout('user', { plan: 'payg', credits: 500 }, { country: 'ES' });
  expect(state.session.mock.calls[0][0]).toMatchObject({ currency: 'usd' });
  state.lastCurrency = 'eur';
  await createCheckout('user', { plan: 'payg', credits: 500 }, { country: 'US' });
  expect(state.session.mock.calls[1][0]).toMatchObject({ currency: 'eur' });
});

it.each(['active', 'trialing'])(
  'charges a %s Pro subscriber their contracted rate even after flag reassignment',
  async (status) => {
    state.subscriptionStatus = status;
    state.customerId = 'cus_existing';
    state.customer.mockResolvedValue({ id: 'cus_existing', currency: 'usd' });
    state.subscription.mockResolvedValue({
      status,
      customer: 'cus_existing',
      currency: 'usd',
      items: { data: [{ price: { id: 'price_pro_control' } }] },
    });
    await createCheckout('user', { plan: 'payg', credits: 2500 });
    expect(state.session.mock.calls[0][0]).toMatchObject({
      mode: 'payment',
      customer: 'cus_existing',
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: 2227 } }],
      metadata: { topup_plan: 'pro', credits: '2500', pricing_variant: 'control' },
    });
    expect(state.session.mock.calls[0][0]).not.toHaveProperty('subscription_data');
    expect(state.purchase.mock.calls[0][0].data).toMatchObject({
      credits: 2500,
      amountCents: 2227,
      currency: 'usd',
    });
  },
);
it('rejects a second monthly subscription but preserves the top-up path', async () => {
  state.subscriptionStatus = 'active';
  state.price.mockResolvedValue(price('pro'));
  await expect(createCheckout('user', { plan: 'pro' })).rejects.toMatchObject({
    code: 'already_subscribed',
  });
  expect(state.session).not.toHaveBeenCalled();
});

it.each([
  ['creator', 'control', 'usd', 950],
  ['creator', 'control', 'eur', 900],
  ['pro', 'control', 'usd', 891],
  ['pro', 'control', 'eur', 836],
  ['scale', 'control', 'usd', 828],
  ['scale', 'control', 'eur', 772],
  ['creator', 'test', 'usd', 1813],
  ['creator', 'test', 'eur', 1688],
  ['pro', 'test', 'usd', 1756],
  ['pro', 'test', 'eur', 1644],
  ['scale', 'test', 'usd', 1658],
  ['scale', 'test', 'eur', 1542],
] as const)(
  'quotes and charges %s %s %s identically',
  async (plan, variant, currency, amountCents) => {
    const { createCheckoutDetails, getTopupPricing } = await import('./billing');
    const { topupAmountCents } = await import('@easyrender/harness');
    state.subscriptionStatus = 'active';
    state.customerId = 'cus_existing';
    state.customer.mockResolvedValue({ id: 'cus_existing', currency });
    state.subscription.mockResolvedValue({
      status: 'active',
      customer: 'cus_existing',
      currency,
      // Portal switches update the actual price, not the old metadata or DB plan.
      metadata: { plan: 'pro', pricing_variant: 'control' },
      items: { data: [{ price: { id: `price_${plan}_${variant}` } }] },
    });
    const quote = await getTopupPricing('user', state.variant, currency);
    expect(topupAmountCents(1000, quote)).toBe(amountCents);
    const body = {
      plan: 'payg',
      credits: 1000,
      expectedAmountCents: amountCents,
      expectedCurrency: currency,
      topup_plan: 'scale',
      amountCents: 1,
      rate: 0.0001,
    };
    const checkout = await createCheckoutDetails('user', body);
    expect(checkout.analytics).toMatchObject({
      value: amountCents / 100,
      currency: currency.toUpperCase(),
    });
    expect(state.session.mock.calls[0][0]).toMatchObject({
      currency,
      adaptive_pricing: { enabled: false },
      line_items: [{ quantity: 1, price_data: { unit_amount: amountCents, currency } }],
    });
    expect(state.purchase.mock.calls[0][0].data).toMatchObject({
      credits: 1000,
      amountCents,
      currency,
      packId: `topup_${plan}${variant === 'test' ? ':test' : ''}`,
    });
  },
);

it.each(['canceled', 'past_due', 'incomplete', 'unpaid', 'paused'])(
  'uses PAYG for Stripe status %s even if DB still says active',
  async (status) => {
    state.subscriptionStatus = 'active';
    state.customerId = 'cus_existing';
    state.customer.mockResolvedValue({ id: 'cus_existing', currency: 'usd' });
    state.subscription.mockResolvedValue({ status, customer: 'cus_existing' });
    await createCheckout('user', { plan: 'payg', credits: 1000 });
    expect(state.session.mock.calls[0][0]).toMatchObject({
      line_items: [{ price: 'price_payg_test', quantity: 1000 }],
    });
    expect(state.purchase.mock.calls[0][0].data.amountCents).toBe(2000);
  },
);
it('rejects stale displayed pack amounts/currencies and forged low amounts', async () => {
  for (const guard of [{ expectedAmountCents: 1 }, { expectedCurrency: 'eur' }]) {
    await expect(
      createCheckout('user', { plan: 'payg', credits: 1000, ...guard }),
    ).rejects.toMatchObject({ code: 'pricing_changed' });
  }
  expect(state.session).not.toHaveBeenCalled();
});
it('fails closed on an unknown or unavailable live subscription', async () => {
  state.subscriptionStatus = 'active';
  state.customerId = 'cus_existing';
  state.customer.mockResolvedValue({ id: 'cus_existing', currency: 'usd' });
  state.subscription.mockResolvedValue({
    status: 'active',
    customer: 'cus_existing',
    currency: 'usd',
    metadata: { plan: 'pro' },
    items: { data: [{ price: { id: 'price_unknown' } }] },
  });
  await expect(createCheckout('user', { plan: 'payg', credits: 1000 })).rejects.toMatchObject({
    code: 'price_mismatch',
  });
  state.subscription.mockRejectedValue(new Error('Stripe unavailable'));
  await expect(createCheckout('user', { plan: 'payg', credits: 1000 })).rejects.toThrow(
    'Stripe unavailable',
  );
  expect(state.session).not.toHaveBeenCalled();
});
