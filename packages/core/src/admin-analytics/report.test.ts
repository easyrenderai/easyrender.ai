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
  viewSets: [],
  upscales: [],
  adSpend: [],
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
          paidAt: null,
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
          previewCompletedAt: null,
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

describe('paid acquisition accounting regressions', () => {
  const at = new Date('2026-11-01T00:00:00Z');
  const model = (
    fields: Partial<Snapshot['renders'][number]> = {},
  ): Snapshot['renders'][number] => ({
    id: 'model',
    userId: 'u',
    anonId: null,
    status: 'ready',
    sheetKey: 'sheet',
    glbKey: 'glb',
    credits: 64,
    costUsd: 2,
    error: null,
    source: 'api',
    isPublic: false,
    createdAt: at,
    completedAt: new Date('2026-11-01T00:10:00Z'),
    previewCompletedAt: at,
    updatedAt: new Date('2026-12-01'),
    ...fields,
  });
  const user = {
    id: 'u',
    email: 'fixture@example.test',
    createdAt: at,
    subscriptionPlan: null,
    subscriptionStatus: null,
    stripeCustomerId: null,
  };
  it('classifies every job refund as returned credits, never promotional credits', () => {
    const s = {
      ...snapshot,
      ledger: [
        'render_failed',
        'product_views_failed',
        'product_view_polish_failed',
        'upscale_failed',
        'signup',
      ].map((reason) => ({ userId: 'u', reason, delta: 100, purchaseId: null, createdAt: at })),
    };
    const r = buildReport('overview', s, range, databaseFinance(s), traffic);
    expect(r.metrics.find((m) => m.key === 'free')?.value).toBe(100);
    expect(r.metrics.find((m) => m.key === 'returned')?.value).toBe(400);
  });
  it('keeps renamed and subsequently failed models in historical activation with immutable durations', () => {
    const s = { ...snapshot, users: [user], renders: [model({ status: 'failed', glbKey: null })] };
    const overview = buildReport('overview', s, range, databaseFinance(s), traffic);
    expect(overview.metrics.find((m) => m.key === 'activatedModel')?.value).toBe(1);
    const product = buildReport('product', s, range, databaseFinance(s), traffic);
    expect(product.metrics.find((m) => m.key === 'models')?.value).toBe(1);
    expect(product.metrics.find((m) => m.key === 'generationMedian')?.value).toBe(10);
  });
  it('does not invent historical model completions from mutable dates or completions after the cutoff', () => {
    const s = {
      ...snapshot,
      users: [user],
      renders: [
        model({ completedAt: null }),
        model({ id: 'future', completedAt: new Date('2026-12-01') }),
        model({ id: 'invalid', completedAt: new Date('2026-10-01') }),
      ],
    };
    const report = buildReport('overview', s, range, databaseFinance(s), traffic);
    expect(report.metrics.find((m) => m.key === 'activatedModel')?.value).toBe(0);
    const product = buildReport('product', s, range, databaseFinance(s), traffic);
    expect(product.metrics.find((m) => m.key === 'models')?.value).toBe(0);
    expect(product.metrics.find((m) => m.key === 'generationMedian')?.value).toBeNull();
  });
  it('includes distinct render, view-set and upscale cost cohorts without copying reused sheets', () => {
    const s: Snapshot = {
      ...snapshot,
      renders: [model()],
      viewSets: [{ id: 'views', userId: 'u', costUsd: 3, createdAt: at }],
      upscales: [
        { id: 'upscale', userId: 'u', costUsd: 1, createdAt: at },
        { id: 'old', userId: 'u', costUsd: 9, createdAt: new Date('2026-01-01') },
      ],
    };
    const r = buildReport('overview', s, range, databaseFinance(s), traffic);
    expect(r.metrics.find((m) => m.key === 'providerCost')).toMatchObject({
      value: 6,
      quality: 'proxy',
    });
    const product = buildReport('product', s, range, databaseFinance(s), traffic);
    // Model-unit cost must not divide unrelated image-service spend by 3D output count.
    expect(product.metrics.find((m) => m.key === 'costModel')?.value).toBe(2);
  });
  it('keeps all refund-dependent net metrics unknown when Stripe reconciliation is unavailable', () => {
    const finance: Finance = {
      isStripe: false,
      payments: [payment({})],
      refunds: [],
      subscriptions: [],
    };
    const report = buildReport('revenue', snapshot, range, finance, traffic);
    for (const key of ['net', 'arpu', 'arppu', 'margin'])
      expect(report.metrics.find((m) => m.key === key)?.value).toBeNull();
    expect(report.tables.find((t) => t.key === 'products')?.rows[0].net).toBeNull();
    expect(report.metrics.find((m) => m.key === 'gross')?.value).toBe(10);
  });
});

it('uses immutable payment time for delayed paid purchases instead of checkout creation', () => {
  const s: Snapshot = {
    ...snapshot,
    purchases: [
      {
        id: 'delayed',
        userId: 'u',
        packId: 'payg',
        credits: 1000,
        amountCents: 1000,
        currency: 'USD',
        status: 'paid',
        createdAt: new Date('2026-10-01'),
        updatedAt: new Date('2026-12-01'),
        paidAt: new Date('2026-11-01'),
      },
    ],
  };
  const finance = databaseFinance(s);
  expect(finance.payments[0].at).toBe('2026-11-01T00:00:00.000Z');
  expect(
    buildReport('overview', s, range, finance, traffic).metrics.find((m) => m.key === 'gross')
      ?.value,
  ).toBe(10);
});

it('uses immutable preview completion for sheet history and excludes future/undated previews', () => {
  const at = new Date('2026-11-01');
  const s: Snapshot = {
    ...snapshot,
    users: [
      {
        id: 'u',
        email: 'u@example.test',
        createdAt: at,
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
        status: 'preview_ready',
        sheetKey: 'sheet',
        glbKey: null,
        credits: 0,
        costUsd: 0,
        error: null,
        source: 'web',
        isPublic: false,
        createdAt: at,
        completedAt: null,
        previewCompletedAt: new Date('2026-11-02'),
        updatedAt: new Date('2026-12-01'),
      },
    ],
  };
  expect(
    buildReport('funnel', s, range, databaseFinance(s), traffic).metrics.find(
      (m) => m.key === 'timeSheet',
    )?.value,
  ).toBe(1440);
  for (const previewCompletedAt of [null, new Date('2026-12-01')]) {
    const pending = { ...s, renders: s.renders.map((r) => ({ ...r, previewCompletedAt })) };
    expect(
      buildReport('overview', pending, range, databaseFinance(pending), traffic).metrics.find(
        (m) => m.key === 'activatedSheet',
      )?.value,
    ).toBe(0);
  }
});
