import type Stripe from 'stripe';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  isActiveSubscription,
  parseCheckout,
  planForPrice,
  planFromInvoice,
  planFromSubscription,
} from './billing';

describe('parseCheckout', () => {
  it('sells only Pro while legacy plans remain recognized by invoices', () => {
    expect(parseCheckout({ plan: 'pro' })).toEqual({ plan: 'pro' });
    for (const plan of ['creator', 'scale'])
      expect(() => parseCheckout({ plan })).toThrow(/Unknown plan/);
  });

  it('accepts pay as you go within bounds, including numeric strings', () => {
    expect(parseCheckout({ plan: 'payg', credits: 2500 })).toEqual({ plan: 'payg', credits: 2500 });
    expect(parseCheckout({ plan: 'payg', credits: '1000' })).toEqual({
      plan: 'payg',
      credits: 1000,
    });
  });

  it('rejects amounts outside the range or fractional', () => {
    for (const credits of [0, 499, 100_001, 1000.5, 'abc', undefined]) {
      expect(() => parseCheckout({ plan: 'payg', credits })).toThrow(/Buy between/);
    }
  });

  it('rejects unknown plans', () => {
    expect(() => parseCheckout({ plan: 'enterprise' })).toThrow(/Unknown plan/);
    expect(() => parseCheckout({})).toThrow(/Unknown plan/);
  });
});

describe('isActiveSubscription', () => {
  it('treats active, trialing and past_due as Pro', () => {
    expect(['active', 'trialing', 'past_due'].map(isActiveSubscription)).toEqual([
      true,
      true,
      true,
    ]);
    expect(['canceled', 'incomplete', 'unpaid', null].map(isActiveSubscription)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });
});

describe('the plan a customer is on', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.STRIPE_PRICE_CREATOR = 'price_creator';
    process.env.STRIPE_PRICE_PRO = 'price_pro';
    process.env.STRIPE_PRICE_SCALE = 'price_scale';
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  const line = (price: string, isProration = false) => ({
    parent: { subscription_item_details: { proration: isProration } },
    pricing: { price_details: { price } },
  });
  const invoice = (lines: ReturnType<typeof line>[], planTag?: string) =>
    ({
      lines: { data: lines },
      parent: { subscription_details: { metadata: planTag ? { plan: planTag } : {} } },
    }) as unknown as Stripe.Invoice;

  it('maps a Stripe price to its plan', () => {
    expect(planForPrice('price_scale')).toBe('scale');
    expect(planForPrice({ id: 'price_creator' })).toBe('creator');
    expect(planForPrice('price_unknown')).toBeNull();
    expect(planForPrice(null)).toBeNull();
  });

  it('credits the plan on the invoice, not the plan tag from checkout, after a portal switch', () => {
    // Checkout tagged the subscription as Scale; the customer then downgraded to Creator.
    expect(planFromInvoice(invoice([line('price_creator')], 'scale'))).toBe('creator');
    // And the other way round.
    expect(planFromInvoice(invoice([line('price_scale')], 'creator'))).toBe('scale');
  });

  it('ignores a proration line for the old plan', () => {
    const lines = [line('price_scale', true), line('price_creator')];
    expect(planFromInvoice(invoice(lines, 'scale'))).toBe('creator');
  });

  it('falls back to the plan tag when the invoice has no known price', () => {
    expect(planFromInvoice(invoice([], 'pro'))).toBe('pro');
    expect(planFromInvoice(invoice([line('price_unknown')]))).toBeNull();
  });

  it('reads the plan from the subscription item first', () => {
    const subscription = {
      items: { data: [{ price: { id: 'price_scale' } }] },
      metadata: { plan: 'creator' },
    } as unknown as Stripe.Subscription;
    expect(planFromSubscription(subscription)).toBe('scale');
  });
});
