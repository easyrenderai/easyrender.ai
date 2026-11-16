import { db } from '@easyrender/db';
import { captureRender } from './analytics';
import { capturePurchase } from './billing';
import { isGoogleMeasurementConfigured } from './google-measurement';
import { enqueueGooglePurchase } from './google-outbox';

/** Repair the commit/enqueue gap from immutable facts only. Legacy unknown times stay unknown. */
export async function reconcileBusinessAnalytics() {
  const hasPosthog = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
  const hasGoogle = isGoogleMeasurementConfigured();
  if (!hasPosthog && !hasGoogle) return { examined: 0 };
  const since = new Date(Date.now() - 7 * 86400000);
  const googleSince = new Date(Date.now() - 72 * 3600000);
  let examined = 0;
  if (hasPosthog) {
    // Indexed anti-joins avoid repeatedly scanning the already-enqueued first page.
    const models = await db().$queryRaw<{ id: string }[]>`
      SELECT r.id FROM "Render" r WHERE r."completedAt" >= ${since} AND (r."userId" IS NOT NULL OR r."anonId" IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM "PosthogDelivery" e WHERE e.event = 'render_ready' AND e."subjectId" = r.id)
      ORDER BY r."completedAt", r.id LIMIT 50`;
    const previews = await db().$queryRaw<{ id: string }[]>`
      SELECT r.id FROM "Render" r WHERE r."previewCompletedAt" >= ${since} AND (r."userId" IS NOT NULL OR r."anonId" IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM "PosthogDelivery" e WHERE e.event = 'preview_ready' AND e."subjectId" = r.id)
      ORDER BY r."previewCompletedAt", r.id LIMIT 50`;
    const rows = await db().render.findMany({
      where: { id: { in: [...models, ...previews].map((row) => row.id) } },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const candidate of models) {
      const render = byId.get(candidate.id);
      if (!render?.completedAt) continue;
      await captureRender(
        'render_ready',
        render,
        { model_id: render.id, formats: 'glb,usdz' },
        { occurredAt: render.completedAt, hasDeferredDelivery: true },
      );
      examined++;
    }
    for (const candidate of previews) {
      const render = byId.get(candidate.id);
      if (!render?.previewCompletedAt) continue;
      await captureRender(
        'preview_ready',
        render,
        {},
        { occurredAt: render.previewCompletedAt, hasDeferredDelivery: true },
      );
      examined++;
    }
  }
  const purchases = await db().$queryRaw<{ id: string; currency: string }[]>`
    SELECT p.id, p.currency FROM "Purchase" p WHERE p.status = 'paid' AND p."paidAt" >= ${since}
    AND ((${hasPosthog} AND (
      NOT EXISTS (SELECT 1 FROM "PosthogDelivery" e WHERE e.event = 'purchase' AND e."subjectId" = p.id)
      OR NOT EXISTS (SELECT 1 FROM "PosthogDelivery" e WHERE e.event = 'purchase_completed' AND e."subjectId" = p.id)))
      OR (${hasGoogle} AND p."paidAt" >= ${googleSince}
        AND NOT EXISTS (SELECT 1 FROM "GooglePurchaseDelivery" d WHERE d."purchaseId" = p.id)
        AND EXISTS (SELECT 1 FROM "GoogleCheckout" c WHERE c."userId" = p."userId"
          AND (c.id = p."stripeSessionId" OR c."invoiceId" = p."stripeSessionId")
          AND c."revokedAt" IS NULL AND c."expiresAt" >= p."paidAt" AND c."clientId" <> '')))
    ORDER BY p."paidAt", p.id LIMIT 50`;
  for (const purchase of purchases) {
    if (hasPosthog) await capturePurchase(purchase.id, true);
    if (hasGoogle) await enqueueGooglePurchase(purchase.id);
    examined++;
  }
  return { examined };
}
