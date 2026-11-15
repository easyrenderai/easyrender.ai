import { randomUUID } from 'node:crypto';
import { db } from '@easyrender/db';
import { isGoogleMeasurementConfigured, sendGooglePurchase } from './google-measurement';
import { reportError } from './report';

/** Called on every signed webhook replay: a missed enqueue can be repaired without another grant. */
export async function enqueueGooglePurchase(purchaseId: string) {
  try {
    await persistGooglePurchase(purchaseId);
  } catch {
    reportError(new Error('Unable to enqueue Google purchase'), { component: 'analytics' });
  }
}
async function persistGooglePurchase(purchaseId: string) {
  if (!isGoogleMeasurementConfigured()) return;
  const purchase = await db().purchase.findUnique({ where: { id: purchaseId } });
  if (purchase?.status !== 'paid') return;
  const checkout = await db().googleCheckout.findFirst({
    where: {
      userId: purchase.userId,
      OR: [{ id: purchase.stripeSessionId }, { invoiceId: purchase.stripeSessionId }],
    },
  });
  if (
    !checkout ||
    checkout.revokedAt ||
    checkout.expiresAt < (purchase.paidAt ?? purchase.updatedAt)
  )
    return;
  await db().googlePurchaseDelivery.upsert({
    where: { purchaseId },
    update: { purchaseId },
    create: { purchaseId, checkoutId: checkout.id },
  });
}

/** Both invoice-first and checkout-first webhook ordering converge on the same purchase ID. */
export async function linkGoogleCheckout(checkoutId: string, invoiceId: string | null) {
  try {
    await persistGoogleCheckoutLink(checkoutId, invoiceId);
  } catch {
    reportError(new Error('Unable to link Google checkout'), { component: 'analytics' });
  }
}
async function persistGoogleCheckoutLink(checkoutId: string, invoiceId: string | null) {
  if (!isGoogleMeasurementConfigured()) return;
  if (invoiceId)
    await db().googleCheckout.updateMany({ where: { id: checkoutId }, data: { invoiceId } });
  const purchase = await db().purchase.findUnique({
    where: { stripeSessionId: invoiceId ?? checkoutId },
  });
  if (purchase?.status === 'paid') await enqueueGooglePurchase(purchase.id);
}

export async function flushGooglePurchases() {
  if (!isGoogleMeasurementConfigured()) return;
  const deadline = Date.now() + 25000;
  let examined = 0;
  for (let batch = 0; batch < 5 && Date.now() < deadline; batch++) {
    const now = new Date();
    const eligible = {
      deliveredAt: null,
      nextAttemptAt: { lte: now },
      AND: [
        { OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] },
        { OR: [{ lastError: null }, { lastError: 'transport' }] },
      ],
    };
    const pending = await db().googlePurchaseDelivery.findMany({
      where: eligible,
      include: { purchase: true, checkout: true },
      orderBy: { nextAttemptAt: 'asc' },
      take: 10,
    });
    if (!pending.length) break;
    await Promise.all(
      pending.map(async (entry) => {
        const leaseToken = randomUUID();
        const { count } = await db().googlePurchaseDelivery.updateMany({
          where: { ...eligible, purchaseId: entry.purchaseId },
          data: { leaseToken, leaseUntil: new Date(+now + 60000), attempts: { increment: 1 } },
        });
        if (!count) return;
        examined++;
        // Refresh consent after claiming; don't send using a stale pre-claim checkout snapshot.
        const checkout = await db().googleCheckout.findUnique({ where: { id: entry.checkoutId } });
        const isExpired =
          +now - +(entry.purchase.paidAt ?? entry.purchase.updatedAt) > 72 * 60 * 60 * 1000;
        const isRevoked = !checkout?.clientId || !checkout.sessionId || Boolean(checkout.revokedAt);
        const result =
          isRevoked || isExpired ? null : await sendGooglePurchase(entry.purchase, checkout);
        await db().googlePurchaseDelivery.updateMany({
          where: { purchaseId: entry.purchaseId, leaseToken },
          data: {
            leaseToken: null,
            leaseUntil: null,
            deliveredAt: result === 'delivered' ? new Date() : null,
            lastError: isRevoked
              ? 'revoked'
              : isExpired
                ? 'expired'
                : result === 'delivered'
                  ? null
                  : 'transport',
            nextAttemptAt: new Date(
              Date.now() + Math.min(3600, 60 * 2 ** Math.min(entry.attempts, 6)) * 1000,
            ),
          },
        });
      }),
    );
  }
  return { examined };
}

/** Erase expired measurement identities, retaining minimal transaction receipts for deduplication. */
export async function cleanGoogleMeasurementIdentities() {
  const expired = await db().googleCheckout.findMany({
    where: {
      expiresAt: { lt: new Date(Date.now() - 30 * 86400000) },
      OR: [{ clientId: { not: '' } }, { sessionId: { not: '' } }],
    },
    orderBy: { expiresAt: 'asc' },
    select: { id: true },
    take: 100,
  });
  if (!expired.length) return { cleared: 0 };
  const result = await db().googleCheckout.updateMany({
    where: { id: { in: expired.map((row) => row.id) } },
    data: { clientId: '', sessionId: '', adMeasurementAllowed: false },
  });
  return { cleared: result.count };
}
