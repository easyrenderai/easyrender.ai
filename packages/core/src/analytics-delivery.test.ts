import { expect, it, vi } from 'vitest';

const work = vi.hoisted(() => ({
  google: vi.fn(),
  posthog: vi.fn(),
  error: vi.fn(),
  clean: vi.fn().mockResolvedValue({ cleared: 1 }),
  health: vi.fn().mockResolvedValue({ google: { pending: 2 } }),
}));
vi.mock('./google-outbox', () => ({
  flushGooglePurchases: work.google,
  cleanGoogleMeasurementIdentities: work.clean,
}));
vi.mock('./posthog-outbox', () => ({ flushPosthogEvents: work.posthog }));
vi.mock('./analytics-delivery-health', () => ({ analyticsDeliveryHealth: work.health }));
vi.mock('./report', () => ({ reportError: work.error }));

vi.mock('./analytics-recovery', () => ({
  reconcileBusinessAnalytics: async () => ({ repaired: 2 }),
}));

import { flushAnalyticsDeliveries } from './analytics-delivery';

it('one broken analytics destination cannot fail render maintenance or prevent the other recovery', async () => {
  work.google.mockRejectedValueOnce(new Error('sensitive transport details'));
  work.posthog.mockResolvedValueOnce({ examined: 3 });
  const result = await flushAnalyticsDeliveries();
  expect(result).toEqual({
    google: { error: 'unavailable' },
    posthog: { examined: 3 },
    privacy: { cleared: 1 },
    health: { google: { pending: 2 } },
    recovery: { repaired: 2 },
  });
  expect(JSON.stringify(result)).not.toContain('sensitive');
  expect(String(work.error.mock.calls[0][0])).not.toContain('sensitive');
});
