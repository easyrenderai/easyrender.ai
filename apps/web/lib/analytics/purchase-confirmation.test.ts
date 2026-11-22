import type { confirmedPurchase } from '@easyrender/core';
import { afterEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  effect: undefined as (() => () => void) | undefined,
  report: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('react', () => ({
  useEffect: (effect: () => () => void) => {
    state.effect = effect;
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: state.refresh }) }));
vi.mock('@/lib/analytics/browser', () => ({ reportPurchaseConversion: state.report }));

import { PurchaseConversion } from '@/components/purchase-conversion';

type Confirmation = NonNullable<Awaited<ReturnType<typeof confirmedPurchase>>>;
const confirmed: Confirmation = {
  transaction_id: 'cs_fixture',
  value: 5,
  currency: 'EUR',
  issued_credits: 500,
  items: [{ item_id: 'payg', quantity: 1, price: 5 }],
  pricing_variant: 'control',
  server_managed: true,
  posthog: null,
};
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it('waits for server verification even with success URL params, then reports a server-managed purchase to PostHog', async () => {
  vi.useFakeTimers();
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 404 }))
    .mockResolvedValueOnce(Response.json(confirmed));
  vi.stubGlobal('fetch', fetcher);
  PurchaseConversion({ sessionId: 'cs_fixture', initial: null });
  const cleanup = state.effect?.();
  expect(state.report).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1000);
  expect(state.report).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(2000);
  expect(state.report).toHaveBeenCalledWith(confirmed);
  expect(state.refresh).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0]).toEqual([
    '/api/checkout/confirmed?session_id=cs_fixture',
    expect.objectContaining({ signal: expect.any(AbortSignal), cache: 'no-store' }),
  ]);
  cleanup?.();
});

it('rejects mismatched confirmation IDs and an in-flight response after unmount', async () => {
  vi.useFakeTimers();
  const pending = Promise.withResolvers<Response>();
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ ...confirmed, transaction_id: 'cs_other' }))
    .mockImplementationOnce(() => pending.promise);
  vi.stubGlobal('fetch', fetcher);
  PurchaseConversion({ sessionId: 'cs_fixture', initial: confirmed });
  const cleanup = state.effect?.();
  await vi.advanceTimersByTimeAsync(1000);
  expect(state.report).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(2000);
  cleanup?.();
  pending.resolve(Response.json(confirmed));
  await vi.advanceTimersByTimeAsync(2000);
  expect(state.report).not.toHaveBeenCalled();
  expect(state.refresh).not.toHaveBeenCalled();
});
