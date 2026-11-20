import { createHash } from 'node:crypto';
import { db } from '@easyrender/db';
import { PRICING_FLAG, type PricingVariant } from '@easyrender/harness';
import { evaluatePricingFlag, isPricingExperimentConfigured, pricingFlag } from './pricing-flag';

export {
  evaluatePricingFlag,
  isPricingExperimentConfigured,
  type PricingFlag,
  pricingFlag,
} from './pricing-flag';

/**
 * A namespaced key/value in the existing Verification store preserves the visitor seed for an
 * account. The primary key makes simultaneous first requests atomic. This is not an auth token;
 * no auth-state/reset identifier can collide. A one-year TTL covers this finite experiment.
 */
export async function pricingIdentity(
  userId: string | null,
  anonId: string | null,
): Promise<string | null> {
  if (!userId) return anonId;
  const key = `${PRICING_FLAG}:identity:${userId}`;
  const stored = await db().verification.upsert({
    where: { id: key },
    update: { id: key },
    create: {
      id: key,
      identifier: key,
      value: anonId || userId,
      expiresAt: new Date(Date.now() + 365 * 86400_000),
    },
    select: { value: true },
  });
  return stored.value;
}

export async function assignedPricing(
  userId: string | null,
  anonId: string | null = null,
): Promise<PricingVariant> {
  if (!isPricingExperimentConfigured()) return 'control';
  const flag = await pricingFlag();
  if (!flag?.active) return 'control';
  try {
    return evaluatePricingFlag(flag, await pricingIdentity(userId, anonId));
  } catch {
    return 'control';
  }
}

// Legacy purchases retain their original pack id. New test purchases snapshot the variant without a migration.
export const purchasePackId = (plan: string, variant: PricingVariant) =>
  variant === 'test' ? `${plan}:test` : plan;
export const purchasedVariant = (packId: string): PricingVariant =>
  packId.endsWith(':test') ? 'test' : 'control';

/** A join key for consented experiment analysis, never an SDK identify call or a new cookie. */
export async function pricingSubject(
  userId: string | null,
  anonId: string | null = null,
): Promise<string | null> {
  let identity = anonId;
  try {
    if (userId) {
      const record = await db().verification.findUnique({
        where: { id: `${PRICING_FLAG}:identity:${userId}` },
        select: { value: true },
      });
      identity = record?.value ?? userId;
    }
  } catch {
    return null;
  }
  return identity ? createHash('sha256').update(`${PRICING_FLAG}:${identity}`).digest('hex') : null;
}
