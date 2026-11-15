import { SUBSCRIPTION_PLANS } from '@easyrender/harness';
import { describe, expect, it } from 'vitest';
import type { Snapshot } from './database';
import { channel, periodRange } from './helpers';
import { buildReport, databaseFinance, type Finance, type Payment, type Traffic } from './report';

const range = periodRange({ period: '30d' }, new Date('2026-11-11T12:00:00Z'));
const traffic: Traffic = {
  visits: null,
  previousVisits: null,
  uniqueVisitors: null,
  previousUniqueVisitors: null,
  dimensions: {},
};
const snapshot: Snapshot = {
  users: [],
  renders: [],
  purchases: [],
  ledger: [],
  keys: [],
  attribution: [],
  renderAttribution: [],
  columns: { user: false, Render: false },
  earliest: '2026-01-01T00:00:00Z',
  fetchedAt: '2026-11-11T12:00:00Z',
  isTruncated: false,
};
const payment = (fields: Partial<Payment>): Payment => ({
  id: 'order',
  userId: 'u',
  at: '2026-11-01T12:00:00Z',
  product: 'payg',
  currency: 'USD',
  gross: 10,
  refunds: 0,
  fees: null,
  country: 'unknown',
  credits: 1000,
  ...fields,
});
describe('admin reports observed output', () => {
  it('exposes operational API/MCP activation tables in the existing product admin report', () => {
    const report = buildReport('product', snapshot, range, databaseFinance(snapshot), traffic);
    expect(report.tables.find((table) => table.key === 'developerActivation')?.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'mcp', activationAccounts: 0, activationPercent: null }),
        expect.objectContaining({ source: 'api', activationAccounts: 0 }),
      ]),
    );
    expect(report.tables.find((table) => table.key === 'developerActivationCohorts')?.note).toBe(
      'developerActivationCoverage',
    );
  });
  it('keeps unavailable fees and cash refunds unknown in DB fallback', () => {
    const report = buildReport('overview', snapshot, range, databaseFinance(snapshot), traffic);
    expect(report.metrics.find((m) => m.key === 'refunds')?.value).toBeNull();
    expect(report.metrics.find((m) => m.key === 'fees')?.value).toBeNull();
    expect(report.metrics.find((m) => m.key === 'visits')?.value).toBeNull();
  });
  it('counts a stored subscription invoice once and preserves its actual paid amount', () => {
    const at = new Date('2026-11-01T00:00:00Z');
    const s: Snapshot = {
      ...snapshot,
      purchases: [
        {
          id: 'invoice',
          userId: 'u',
          packId: 'pro',
          credits: SUBSCRIPTION_PLANS.pro.monthlyCredits,
          amountCents: 1234,
          currency: 'usd',
          status: 'paid',
          createdAt: at,
          updatedAt: at,
        },
      ],
      ledger: [
        {
          userId: 'u',
          delta: SUBSCRIPTION_PLANS.pro.monthlyCredits,
          reason: 'subscription',
          purchaseId: 'invoice',
          createdAt: at,
        },
      ],
    };
    expect(databaseFinance(s).payments).toMatchObject([{ id: 'invoice', gross: 12.34 }]);
    expect(databaseFinance(s).payments).toHaveLength(1);
  });
  it('retains legacy subscription grants without a Purchase link', () => {
    const s: Snapshot = {
      ...snapshot,
      ledger: [
        {
          userId: 'u',
          delta: SUBSCRIPTION_PLANS.pro.monthlyCredits,
          reason: 'subscription',
          purchaseId: null,
          createdAt: new Date('2026-11-01T00:00:00Z'),
        },
      ],
    };
    expect(databaseFinance(s).payments).toMatchObject([
      { product: 'pro', credits: SUBSCRIPTION_PLANS.pro.monthlyCredits },
    ]);
  });
  it('does not turn unknown Stripe fees into zero', () => {
    const finance: Finance = {
      isStripe: true,
      payments: [payment({})],
      refunds: [],
      subscriptions: [],
    };
    const r = buildReport('revenue', snapshot, range, finance, traffic);
    expect(r.metrics.find((m) => m.key === 'fees')?.value).toBeNull();
  });
  it('retains refund-only products and previous-only currencies', () => {
    const finance: Finance = {
      isStripe: true,
      payments: [payment({ at: '2026-09-25T12:00:00Z', currency: 'EUR' })],
      refunds: [
        {
          id: 'refund',
          userId: 'u',
          at: '2026-11-01T00:00:00Z',
          currency: 'USD',
          amount: 4,
          product: 'creator',
        },
      ],
      subscriptions: [],
    };
    const r = buildReport('revenue', snapshot, range, finance, traffic);
    expect(r.tables.find((t) => t.key === 'products')?.rows).toContainEqual({
      product: 'creator',
      currency: 'USD',
      orders: 0,
      units: 0,
      gross: 0,
      refunds: 4,
      net: -4,
      average: null,
    });
    expect(r.metrics.find((m) => m.key === 'gross' && m.currency === 'EUR')).toMatchObject({
      value: 0,
      previous: 10,
    });
  });
  it('prototype property UTMs cannot escape the channel enumeration', () => {
    expect(channel({ utm_medium: 'constructor' })).toBe('referral');
    expect(channel({ utm_medium: '__proto__' })).toBe('referral');
  });
  it('does not call dev credit grants cash revenue', () => {
    const s = {
      ...snapshot,
      ledger: [
        {
          userId: 'u',
          delta: 500,
          reason: 'dev_purchase',
          purchaseId: null,
          createdAt: new Date('2026-11-01T00:00:00Z'),
        },
      ],
    };
    expect(databaseFinance(s).payments).toEqual([]);
    expect(
      buildReport('overview', s, range, databaseFinance(s), traffic).metrics.find(
        (m) => m.key === 'free',
      )?.value,
    ).toBe(500);
  });
  it('older converted accounts cannot inflate signup activation', () => {
    const s: Snapshot = {
      ...snapshot,
      users: [
        {
          id: 'u',
          email: 'fixture@example.test',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          subscriptionPlan: null,
          subscriptionStatus: null,
          stripeCustomerId: null,
        },
      ],
      renders: [
        {
          id: 'r',
          userId: 'u',
          anonId: null,
          status: 'ready',
          sheetKey: 'sheet',
          glbKey: 'model',
          credits: 64,
          costUsd: 0.19,
          error: null,
          source: 'web',
          isPublic: true,
          completedAt: null,
          createdAt: new Date('2026-11-01T00:00:00Z'),
          updatedAt: new Date('2026-11-01T00:02:00Z'),
        },
      ],
    };
    const r = buildReport('overview', s, range, databaseFinance(s), traffic);
    expect(r.metrics.find((m) => m.key === 'activatedModel')?.value).toBe(0);
    expect(r.metrics.find((m) => m.key === 'modelActivation')?.value).toBeNull();
  });
});

it('retains traffic-only campaigns and previous-only chart buckets', () => {
  const s = { ...snapshot, columns: { user: true, Render: true } };
  const r = buildReport('attribution', s, range, databaseFinance(s), {
    ...traffic,
    dimensions: { campaign: [{ value: 'c09-no-conversion', visits: 500 }] },
  });
  expect(r.tables.find((t) => t.key === 'utm_campaign')?.rows).toContainEqual(
    expect.objectContaining({ name: 'c09-no-conversion', visits: 500, signups: 0, paying: 0 }),
  );
  const finance: Finance = {
    isStripe: true,
    payments: [payment({ at: '2026-09-25T12:00:00Z' })],
    refunds: [],
    subscriptions: [],
  };
  const overview = buildReport('overview', s, range, finance, traffic);
  expect(
    overview.charts
      .find((c) => c.key === 'incomeUsage')
      ?.rows.some((r) => r.previousRevenue === 10 && r.revenue === 0),
  ).toBe(true);
});
