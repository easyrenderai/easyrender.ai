import { SUBSCRIPTION_PLANS } from '@easyrender/harness';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('./auth', () => ({ requireAdmin: async () => ({ id: 'admin' }) }));
vi.mock('@easyrender/core/admin-analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@easyrender/core/admin-analytics')>()),
  attributionColumns: async () => ({ user: true, Render: true }),
  loadDatabase: async () => {
    const at = new Date('2026-11-01T00:00:00Z');
    return {
      users: [],
      renders: [
        {
          id: 'finished',
          userId: 'u',
          createdAt: at,
          previewCompletedAt: new Date('2026-11-01T00:30Z'),
          completedAt: new Date('2026-11-01T01:00Z'),
          updatedAt: new Date('2027-01-01'),
          status: 'failed',
          glbKey: null,
          sheetKey: null,
          costUsd: 0,
          source: 'api',
          isPublic: false,
        },
        {
          id: 'legacy',
          userId: 'u',
          createdAt: at,
          previewCompletedAt: null,
          completedAt: null,
          updatedAt: at,
          status: 'ready',
          glbKey: 'model',
          sheetKey: 'sheet',
          costUsd: 0,
          source: 'api',
          isPublic: false,
        },
        {
          id: 'legacy2',
          userId: 'u',
          createdAt: at,
          previewCompletedAt: null,
          completedAt: null,
          updatedAt: at,
          status: 'ready',
          glbKey: 'model',
          sheetKey: 'sheet',
          costUsd: 0,
          source: 'api',
          isPublic: false,
        },
      ],
      viewSets: [],
      upscales: [],
      adSpend: [],
      keys: [],
      attribution: [],
      renderAttribution: [],
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
          paidAt: at,
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
      columns: { user: true, Render: true },
      earliest: at.toISOString(),
      fetchedAt: at.toISOString(),
      isTruncated: false,
    };
  },
}));

import { periodRange } from '@easyrender/core/admin-analytics';
import { dashboardData } from './data';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('serves DB metrics and accurate purchase reconciliation with PostHog and Stripe unset', async () => {
  for (const key of [
    'POSTHOG_API_HOST',
    'POSTHOG_PROJECT_ID',
    'POSTHOG_PERSONAL_API_KEY',
    'NEXT_PUBLIC_POSTHOG_KEY',
    'NEXT_PUBLIC_POSTHOG_HOST',
    'POSTHOG_HOST',
    'STRIPE_ANALYTICS_KEY',
    'STRIPE_SECRET_KEY',
  ]) {
    vi.stubEnv(key, '');
  }
  const fetcher = vi.fn<typeof fetch>(() => {
    throw new Error('Unexpected external request');
  });
  vi.stubGlobal('fetch', fetcher);
  const range = periodRange({ period: '30d' }, new Date('2026-11-12T00:00:00Z'));
  const overview = await dashboardData('overview', range);
  expect(overview.view.metrics.find((metric) => metric.key === 'gross')?.value).toBe(12.34);
  expect(overview.view.metrics.find((metric) => metric.key === 'visits')?.value).toBeNull();
  expect(overview.view.notes).toContain('posthogUnavailable');
  expect(overview.health.find((source) => source.source === 'posthog')).toMatchObject({
    configured: false,
    missing: ['POSTHOG_PROJECT_ID', 'POSTHOG_PERSONAL_API_KEY'],
    error: null,
  });
  const health = await dashboardData('health', range);
  expect(health.view.tables.find((table) => table.key === 'reconciliation')?.rows).toContainEqual({
    event: 'purchase',
    database: 1,
    posthog: null,
    difference: null,
  });
  expect(health.view.tables.find((table) => table.key === 'reconciliation')?.rows).toContainEqual({
    event: 'render_ready',
    database: 1,
    posthog: null,
    difference: null,
  });
  expect(health.view.tables.find((table) => table.key === 'reconciliation')?.rows).toContainEqual({
    event: 'preview_ready',
    database: 1,
    posthog: null,
    difference: null,
  });
  expect(health.view.tables.find((table) => table.key === 'reconciliation')?.rows).toContainEqual({
    event: 'preview_start',
    database: null,
    posthog: null,
    difference: null,
  });
  expect(fetcher).not.toHaveBeenCalled();
});
