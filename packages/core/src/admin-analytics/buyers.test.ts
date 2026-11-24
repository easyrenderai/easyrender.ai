import { describe, expect, it } from 'vitest';
import { aggregateBuyers } from './buyers';

const at = (day: number) => new Date(`2026-11-${String(day).padStart(2, '0')}T12:00:00Z`);
const users = [
  { id: 'buyer', email: 'john@example.test', credits: 83 },
  { id: 'gift-only', email: 'private@example.test', credits: 500 },
  { id: 'subscriber', email: 'subscriber@example.test', credits: 100 },
];
const purchase = (id: string, overrides = {}) => ({
  id,
  userId: 'buyer',
  credits: 100,
  amountCents: 250,
  currency: 'usd',
  status: 'paid',
  createdAt: at(1),
  paidAt: at(2),
  ...overrides,
});
const ledger = (delta: number, reason: string, overrides = {}) => ({
  userId: 'buyer',
  delta,
  reason,
  purchaseId: null,
  createdAt: at(3),
  ...overrides,
});

describe('lifetime buyers', () => {
  it('counts paid purchases once and keeps currencies, gifts, refunds and balances honest', () => {
    const rows = aggregateBuyers(
      users,
      [
        purchase('p1'),
        purchase('p2', { currency: 'eur', paidAt: at(4) }),
        purchase('pending', { status: 'pending' }),
        purchase('failed', { status: 'failed' }),
      ],
      [
        ledger(100, 'purchase', { purchaseId: 'p1' }),
        ledger(100, 'subscription', { purchaseId: 'p2' }),
        ledger(50, 'outreach_credit_invite'),
        ledger(20, 'referral_kickback'),
        ledger(-5, 'referral_kickback_reversed'),
        ledger(-40, 'render'),
        ledger(-12, 'agent_chat'),
        ledger(40, 'render_failed'),
        ledger(10, 'sheet_redraw_failed'),
        ledger(2, 'build_quality_refund'),
        ledger(7, 'dev_purchase'),
        ledger(500, 'outreach_credit_invite', { userId: 'gift-only' }),
      ],
    );
    expect(rows).toEqual([
      {
        id: 'buyer',
        email: 'jo***@e***.test',
        purchases: 2,
        purchased: 200,
        gifted: 65,
        other: 7,
        used: 52,
        refunded: 52,
        remaining: 83,
        amounts: { USD: 250, EUR: 250 },
        unknownAmounts: 0,
        firstPurchase: at(2).toISOString(),
        lastPurchase: at(4).toISOString(),
      },
    ]);
    expect(JSON.stringify(rows)).not.toContain('john@example.test');
  });
  it('includes historical subscriptions without inventing money, sorted by last purchase', () => {
    const rows = aggregateBuyers(
      users,
      [purchase('p1', { paidAt: null })],
      [
        ledger(100, 'subscription', { userId: 'subscriber', createdAt: at(5) }),
        ledger(20, 'purchase', { userId: 'subscriber', createdAt: at(6) }),
        ledger(100, 'subscription', { purchaseId: 'missing-purchase' }),
        ledger(-50, 'subscription'),
        ledger(0, 'purchase'),
      ],
    );
    expect(rows.map((r) => r.id)).toEqual(['subscriber', 'buyer']);
    expect(rows[0]).toMatchObject({
      purchases: 2,
      purchased: 120,
      amounts: {},
      unknownAmounts: 2,
      firstPurchase: at(5).toISOString(),
      lastPurchase: at(6).toISOString(),
    });
    expect(rows[1].firstPurchase).toBe(at(1).toISOString());
  });
  it('counts invoiced Shopify credits and excludes tests and uncredited purchases', () => {
    const shopify = (id: string, overrides = {}) => ({
      ...purchase(id),
      status: 'active',
      creditedAt: at(8),
      isTest: false,
      ...overrides,
    });
    const rows = aggregateBuyers(
      users,
      [],
      [ledger(100, 'shopify_purchase')],
      [
        shopify('real'),
        shopify('test', { isTest: true, credits: 30 }),
        shopify('gift-only-test', { isTest: true, userId: 'gift-only' }),
        shopify('uncredited', { creditedAt: null }),
        shopify('pending', { status: 'pending' }),
      ],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      purchases: 1,
      purchased: 100,
      other: 30,
      gifted: 0,
      amounts: { USD: 250 },
    });
  });
  it('does not treat gift, dev, test-only or orphaned ledger accounts as buyers', () => {
    expect(
      aggregateBuyers(
        users,
        [],
        [
          ledger(100, 'dev_subscription'),
          ledger(100, 'first_model_trial'),
          ledger(100, 'subscription', { userId: 'deleted' }),
        ],
      ),
    ).toEqual([]);
  });
});
