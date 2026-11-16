import { randomInt } from 'node:crypto';
import { db, type Prisma } from '@easyrender/db';
import { RENDER_CREDITS } from '@easyrender/harness';
import { grantCreditsInTransaction } from './credits';
import { AppError } from './errors';
import { assignedPricing } from './pricing-experiment';
import type { Actor } from './renders';

export const FIRST_MODEL_CAMPAIGN = 'first-model-2026-11';
export async function configureFirstModelCampaign(input: { isActive: boolean; maxOffers: number }) {
  if (typeof input.isActive !== 'boolean' || ![100, 250, 500].includes(input.maxOffers))
    throw new AppError('Choose a pilot of 100, 250 or 500 offers', 400, 'bad_trial_config');
  return db().$transaction(async (tx) => {
    await lockCampaign(tx);
    const existing = await tx.firstModelCampaign.findUnique({
      where: { id: FIRST_MODEL_CAMPAIGN },
    });
    if (existing) {
      if (existing.maxOffers !== input.maxOffers)
        throw new AppError(
          'The sample size is fixed after starting the pilot',
          409,
          'trial_already_started',
        );
      if (input.isActive && existing.endsAt <= new Date())
        throw new AppError('This pilot has ended', 409, 'trial_ended');
      return tx.firstModelCampaign.update({
        where: { id: existing.id },
        data: { isActive: input.isActive },
      });
    }
    if (!input.isActive) return null;
    return tx.firstModelCampaign.create({
      data: {
        id: FIRST_MODEL_CAMPAIGN,
        isActive: true,
        maxOffers: input.maxOffers,
        endsAt: new Date(Date.now() + 14 * 86400000),
      },
    });
  });
}
export type FirstModelOffer = {
  variant: 'control' | 'free_model';
  state: 'signup' | 'verify' | 'ready' | 'used';
  email?: string;
};

// Shared by enrollment, account binding and redemption. No provider requests under this lock.
async function lockCampaign(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${FIRST_MODEL_CAMPAIGN}, 0))`;
}

export async function bindFirstModelEnrollment(
  userId: string,
  anonId: string | null,
): Promise<void> {
  if (!anonId) return;
  await db().$transaction(async (tx) => {
    await lockCampaign(tx);
    const entry = await tx.firstModelEnrollment.findUnique({ where: { anonId } });
    if (!entry || entry.boundAt) return;
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.createdAt < entry.enrolledAt) return;
    if (await tx.firstModelEnrollment.findUnique({ where: { userId } })) return;
    await tx.firstModelEnrollment.update({
      where: { id: entry.id },
      data: { userId, boundAt: new Date() },
    });
  });
}

export async function firstModelOffer(
  renderId: string,
  actor: Actor,
): Promise<FirstModelOffer | null> {
  if (actor.source !== 'web' || actor.apiKeyId) return null;
  const render = await db().render.findUnique({ where: { id: renderId } });
  if (render?.source !== 'web' || render.status !== 'preview_ready' || !render.anonId) return null;
  if (render.userId ? render.userId !== actor.userId : render.anonId !== actor.anonId) return null;
  if (actor.userId) await bindFirstModelEnrollment(actor.userId, render.anonId);
  const pricingVariant = await assignedPricing(actor.userId ?? null, render.anonId);
  return db().$transaction(async (tx) => {
    await lockCampaign(tx);
    let entry = await tx.firstModelEnrollment.findUnique({
      where: { anonId: render.anonId as string },
    });
    if (!entry) {
      if (actor.userId || render.userId || !actor.ipHash) return null;
      const campaign = await tx.firstModelCampaign.findUnique({
        where: { id: FIRST_MODEL_CAMPAIGN },
      });
      if (
        !campaign?.isActive ||
        campaign.endsAt <= new Date() ||
        campaign.enrolled >= campaign.maxOffers * 2
      )
        return null;
      // Same rule for both arms; no fingerprint or new cookie. Existing preview limits also apply.
      if (
        await tx.firstModelEnrollment.findFirst({
          where: { ipHash: actor.ipHash, enrolledAt: { gte: new Date(Date.now() - 86400000) } },
        })
      )
        return null;
      const variant = campaign.nextVariant ?? (randomInt(2) ? 'free_model' : 'control');
      entry = await tx.firstModelEnrollment.create({
        data: {
          campaignId: campaign.id,
          anonId: render.anonId as string,
          ipHash: actor.ipHash,
          variant,
          pricingVariant,
        },
      });
      await tx.firstModelCampaign.update({
        where: { id: campaign.id },
        data: {
          enrolled: { increment: 1 },
          nextVariant: campaign.nextVariant
            ? null
            : variant === 'control'
              ? 'free_model'
              : 'control',
        },
      });
    }
    if (entry.boundAt && entry.userId !== actor.userId) return null;
    if (actor.userId && entry.userId !== actor.userId) return null;
    const user = entry.userId ? await tx.user.findUnique({ where: { id: entry.userId } }) : null;
    return {
      variant: entry.variant === 'free_model' ? 'free_model' : 'control',
      ...(user && !user.emailVerified ? { email: user.email } : {}),
      state: entry.grantedAt ? 'used' : !user ? 'signup' : user.emailVerified ? 'ready' : 'verify',
    };
  });
}

// Called only by startBuild, within the same transaction as the ordinary debit/state transition.
export async function grantFirstModelInTransaction(
  tx: Prisma.TransactionClient,
  renderId: string,
  actor: Actor,
  amount: number,
): Promise<boolean> {
  if (actor.source !== 'web' || actor.apiKeyId || !actor.userId) return false;
  await lockCampaign(tx);
  const entry = await tx.firstModelEnrollment.findUnique({ where: { userId: actor.userId } });
  if (entry?.variant !== 'free_model' || entry.grantedAt) return false;
  const render = await tx.render.findUnique({ where: { id: renderId } });
  if (
    !render ||
    render.userId !== actor.userId ||
    render.anonId !== entry.anonId ||
    render.source !== 'web' ||
    render.credits !== 0
  )
    return false;
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > RENDER_CREDITS) return false;
  const user = await tx.user.findUniqueOrThrow({ where: { id: actor.userId } });
  if (!user.emailVerified)
    throw new AppError('Verify your email to use your free model', 403, 'trial_verify_email');
  if (
    await tx.render.findFirst({
      where: {
        userId: actor.userId,
        id: { not: renderId },
        OR: [{ credits: { gt: 0 } }, { status: 'ready' }],
      },
    })
  )
    return false;
  const isGranted = await grantCreditsInTransaction(tx, {
    userId: actor.userId,
    amount,
    key: `first-model:${FIRST_MODEL_CAMPAIGN}:${actor.userId}`,
    reason: 'first_model_trial',
    renderId,
  });
  if (!isGranted) return false;
  await tx.firstModelEnrollment.update({
    where: { id: entry.id },
    data: { grantedAt: new Date(), grantRenderId: renderId, grantCredits: amount },
  });
  return true;
}

/** Authoritative bounded-pilot report; no analytics-consent subset in the denominator. */
export async function firstModelReport(now = new Date()) {
  const campaign = await db().firstModelCampaign.findUnique({
    where: { id: FIRST_MODEL_CAMPAIGN },
  });
  const entries = await db().firstModelEnrollment.findMany({
    where: { campaignId: FIRST_MODEL_CAMPAIGN },
    orderBy: { enrolledAt: 'asc' },
  });
  const userIds = entries.flatMap((entry) => (entry.userId ? [entry.userId] : []));
  const [renders, purchases] = entries.length
    ? await Promise.all([
        db().render.findMany({
          where: {
            OR: [{ anonId: { in: entries.map((e) => e.anonId) } }, { userId: { in: userIds } }],
          },
          select: { anonId: true, userId: true, completedAt: true, costUsd: true, status: true },
        }),
        db().purchase.findMany({
          where: { userId: { in: userIds }, status: 'paid', paidAt: { lte: now } },
          select: { userId: true, paidAt: true, currency: true, amountCents: true },
        }),
      ])
    : [[], []];
  const observations = entries.map((entry) => ({
    entry,
    models: renders.filter((r) =>
      r.userId ? r.userId === entry.userId : r.anonId === entry.anonId,
    ),
    payments: purchases.filter(
      (p) => p.userId === entry.userId && p.paidAt && p.paidAt >= entry.enrolledAt,
    ),
  }));
  const variants = ['control', 'free_model'] as const;
  const windows = [7, 30].flatMap((days) =>
    variants.flatMap((variant) =>
      ['all', 'control', 'test'].map((pricingVariant) => {
        const mature = observations.filter(
          ({ entry }) =>
            entry.variant === variant &&
            (pricingVariant === 'all' || entry.pricingVariant === pricingVariant) &&
            now.getTime() - entry.enrolledAt.getTime() >= days * 86400000,
        );
        let signups = 0,
          firstModels = 0,
          secondModels = 0,
          payers = 0;
        for (const { entry, models, payments } of mature) {
          const end = new Date(entry.enrolledAt.getTime() + days * 86400000);
          if (entry.boundAt && entry.boundAt <= end) signups++;
          const completed = models.filter(
            (r) => r.completedAt && r.completedAt >= entry.enrolledAt && r.completedAt <= end,
          ).length;
          if (completed >= 1) firstModels++;
          if (completed >= 2) secondModels++;
          if (payments.some((p) => p.paidAt && p.paidAt <= end)) payers++;
        }
        return {
          days,
          variant,
          pricingVariant,
          matureVisitors: mature.length,
          signups,
          firstModels,
          secondModels,
          payers,
        };
      }),
    ),
  );
  const arms = variants.map((variant) => {
    const selected = observations.filter(({ entry }) => entry.variant === variant);
    const revenueCentsByCurrency: Record<string, number> = {};
    let recordedProviderCostUsd = 0,
      failedModels = 0;
    for (const { models, payments } of selected) {
      recordedProviderCostUsd += models.reduce((sum, r) => sum + r.costUsd, 0);
      failedModels += models.filter((r) => r.status === 'failed').length;
      for (const payment of payments)
        revenueCentsByCurrency[payment.currency] =
          (revenueCentsByCurrency[payment.currency] ?? 0) + payment.amountCents;
    }
    return {
      variant,
      enrolled: selected.length,
      signups: selected.filter(({ entry }) => entry.boundAt).length,
      granted: selected.filter(({ entry }) => entry.grantedAt).length,
      recordedProviderCostUsd,
      failedModels,
      revenueCentsByCurrency,
      netBeforeFeesUsdEstimate: Object.keys(revenueCentsByCurrency).some(
        (currency) => currency !== 'usd',
      )
        ? null
        : (revenueCentsByCurrency.usd ?? 0) / 100 - recordedProviderCostUsd,
    };
  });
  const revenueCentsByCurrency: Record<string, number> = {};
  for (const arm of arms)
    for (const [currency, cents] of Object.entries(arm.revenueCentsByCurrency))
      revenueCentsByCurrency[currency] = (revenueCentsByCurrency[currency] ?? 0) + cents;
  return { campaign, generatedAt: now.toISOString(), windows, arms, revenueCentsByCurrency };
}
