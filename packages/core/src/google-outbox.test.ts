import { beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  purchase: {
    id: 'p1',
    userId: 'u1',
    stripeSessionId: 'cs_1',
    status: 'paid',
    packId: 'payg',
    amountCents: 1000,
    currency: 'eur',
    updatedAt: new Date(),
  },
  checkout: {
    id: 'cs_1',
    userId: 'u1',
    clientId: '123.456',
    sessionId: '123',
    expiresAt: new Date(Date.now() + 86400000),
    revokedAt: null as Date | null,
  },
  hasDbFailure: false,
  rows: new Map<string, Record<string, unknown>>(),
  sent: vi.fn(),
}));
vi.mock('./google-measurement', () => ({
  isGoogleMeasurementConfigured: () => true,
  sendGooglePurchase: state.sent,
}));
vi.mock('@easyrender/db', () => ({
  db: () => ({
    purchase: {
      findUnique: async () => {
        if (state.hasDbFailure) throw new Error('fixture database failure');
        return state.purchase;
      },
    },
    googleCheckout: {
      findFirst: async () => state.checkout,
      findUnique: async () => state.checkout,
    },
    googlePurchaseDelivery: {
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        if (!state.rows.has(String(create.purchaseId)))
          state.rows.set(String(create.purchaseId), {
            ...create,
            attempts: 0,
            deliveredAt: null,
            leaseUntil: null,
            nextAttemptAt: new Date(0),
          });
      },
      findMany: async () =>
        [...state.rows.values()]
          .filter((r) => !r.deliveredAt && !r.lastError)
          .map((r) => ({ ...r, purchase: state.purchase, checkout: state.checkout })),
      updateMany: async ({
        where,
        data,
      }: {
        where: { purchaseId: string; leaseToken?: string };
        data: Record<string, unknown>;
      }) => {
        const r = state.rows.get(where.purchaseId);
        if (
          !r ||
          (where.leaseToken ? r.leaseToken !== where.leaseToken : r.deliveredAt || r.leaseUntil)
        )
          return { count: 0 };
        Object.assign(r, data);
        return { count: 1 };
      },
      update: async ({
        where,
        data,
      }: {
        where: { purchaseId: string; leaseToken?: string };
        data: Record<string, unknown>;
      }) => Object.assign(state.rows.get(where.purchaseId) ?? {}, data),
    },
  }),
}));

vi.mock('./report', () => ({ reportError: vi.fn() }));

import { enqueueGooglePurchase, flushGooglePurchases } from './google-outbox';

beforeEach(() => {
  state.rows.clear();
  state.hasDbFailure = false;
  state.sent.mockReset();
  state.sent.mockResolvedValue('delivered');
  state.purchase.status = 'paid';
  state.checkout.revokedAt = null;
});
it('enqueues a confirmed purchase once across webhook replays and delivers without a browser return', async () => {
  await enqueueGooglePurchase('p1');
  await enqueueGooglePurchase('p1');
  expect(state.rows.size).toBe(1);
  await flushGooglePurchases();
  await flushGooglePurchases();
  expect(state.sent).toHaveBeenCalledTimes(1);
  expect(state.rows.get('p1')?.deliveredAt).toBeInstanceOf(Date);
});
it('never enqueues pending or revoked purchases', async () => {
  state.purchase.status = 'pending';
  await enqueueGooglePurchase('p1');
  state.purchase.status = 'paid';
  state.checkout.revokedAt = new Date();
  await enqueueGooglePurchase('p1');
  expect(state.rows.size).toBe(0);
});
it('retains failed deliveries with a retry time and honors revocation before delivery', async () => {
  await enqueueGooglePurchase('p1');
  state.sent.mockResolvedValue('retry');
  await flushGooglePurchases();
  expect(state.rows.get('p1')).toMatchObject({
    deliveredAt: null,
    lastError: 'transport',
    leaseUntil: null,
  });
  expect(state.rows.get('p1')?.nextAttemptAt).toBeInstanceOf(Date);
  state.rows.clear();
  await enqueueGooglePurchase('p1');
  state.checkout.revokedAt = new Date();
  await flushGooglePurchases();
  expect(state.rows.get('p1')?.lastError).toBe('revoked');
  expect(state.sent).toHaveBeenCalledTimes(1);
});

it('an analytics enqueue outage does not reject an already committed payment', async () => {
  state.hasDbFailure = true;
  await expect(enqueueGooglePurchase('p1')).resolves.toBeUndefined();
});
