import { db } from '@easyrender/db';

/** Aggregates only: no account, transaction, campaign, measurement identifiers or payloads. */
export async function analyticsDeliveryHealth() {
  const googlePending = {
    deliveredAt: null,
    OR: [{ lastError: null }, { lastError: 'transport' }],
  };
  const posthogPending = { deliveredAt: null, deadAt: null };
  const [google, googleExpired, googleOldest, posthog, posthogDead, posthogOldest] =
    await Promise.all([
      db().googlePurchaseDelivery.count({ where: googlePending }),
      db().googlePurchaseDelivery.count({ where: { lastError: 'expired' } }),
      db().$queryRaw<{ oldest: Date | null }[]>`
      SELECT MIN(COALESCE(p."paidAt", p."updatedAt")) AS oldest
      FROM "GooglePurchaseDelivery" d JOIN "Purchase" p ON p.id = d."purchaseId"
      WHERE d."deliveredAt" IS NULL AND (d."lastError" IS NULL OR d."lastError" = 'transport')`,
      db().posthogDelivery.count({ where: posthogPending }),
      db().posthogDelivery.count({ where: { deadAt: { not: null } } }),
      db().posthogDelivery.findFirst({
        where: posthogPending,
        orderBy: { occurredAt: 'asc' },
        select: { occurredAt: true },
      }),
    ]);
  const age = (date: Date | undefined) =>
    date ? Math.max(0, Math.floor((Date.now() - +date) / 1000)) : null;
  return {
    google: {
      pending: google,
      expired: googleExpired,
      oldestPendingSeconds: age(googleOldest[0]?.oldest ?? undefined),
    },
    posthog: {
      pending: posthog,
      dead: posthogDead,
      oldestPendingSeconds: age(posthogOldest?.occurredAt),
    },
  };
}
