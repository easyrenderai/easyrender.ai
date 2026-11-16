import { expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ at: new Date(Date.now() - 120000) }));
vi.mock('@easyrender/db', () => ({
  db: () => ({
    $queryRaw: async () => [{ oldest: state.at }],
    googlePurchaseDelivery: {
      count: async () => 2,
      findFirst: async () => ({ purchase: { paidAt: new Date(), updatedAt: new Date() } }),
    },
    posthogDelivery: { count: async () => 1, findFirst: async () => ({ occurredAt: state.at }) },
  }),
}));

import { analyticsDeliveryHealth } from './analytics-delivery-health';

it('returns only aggregate counts and pending age from original event time', async () => {
  const result = await analyticsDeliveryHealth();
  expect(result).toEqual({
    google: { pending: 2, expired: 2, oldestPendingSeconds: 120 },
    posthog: { pending: 1, dead: 1, oldestPendingSeconds: 120 },
  });
  expect(Object.keys(result.google)).toEqual(['pending', 'expired', 'oldestPendingSeconds']);
});
