import { db, type Prisma } from '@easyrender/db';
import { MICRO_CREDITS_PER_CREDIT, REFERRAL_KICKBACK } from '@easyrender/harness';
import { AppError } from './errors';

export async function getBalance(userId: string): Promise<number> {
  const user = await db().user.findUnique({ where: { id: userId }, select: { credits: true } });
  return user?.credits ?? 0;
}

type CreditMutation = {
  userId: string;
  apiKeyId?: string;
  amount: number;
  key: string;
  reason: string;
  renderId?: string;
  purchaseId?: string;
};

function validateAmount(amount: number) {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new AppError('Invalid credit amount', 400, 'invalid_credits');
  }
}

// These helpers compose the ledger and wallet change with the caller's state transition. A
// duplicate ledger key is a no-op without aborting the surrounding PostgreSQL transaction.
export async function spendCreditsInTransaction(
  tx: Prisma.TransactionClient,
  input: CreditMutation,
): Promise<boolean> {
  validateAmount(input.amount);
  const inserted = await tx.creditLedger.createMany({
    data: {
      userId: input.userId,
      delta: -input.amount,
      reason: input.reason,
      idempotencyKey: input.key,
      renderId: input.renderId,
    },
    skipDuplicates: true,
  });
  if (!inserted.count) return false;
  if (input.apiKeyId) {
    // Serialize debits against this key across workers. Wallet, key cap and ledger commit together.
    await tx.$queryRaw`SELECT id FROM "ApiKey" WHERE id = ${input.apiKeyId} FOR UPDATE`;
    const apiKey = await tx.apiKey.findUnique({ where: { id: input.apiKeyId } });
    if (
      !apiKey ||
      apiKey.userId !== input.userId ||
      !apiKey.scopes.includes('spend') ||
      (apiKey.expiresAt && apiKey.expiresAt <= new Date())
    ) {
      throw new AppError('This API key cannot authorize spending', 403, 'insufficient_scope');
    }
    if (apiKey.creditLimit !== null && input.amount > apiKey.creditLimit - apiKey.spentCredits) {
      throw new AppError('API key credit budget exceeded', 403, 'key_budget_exceeded');
    }
    await tx.apiKey.update({
      where: { id: apiKey.id },
      data: { spentCredits: { increment: input.amount } },
    });
  }
  const { count } = await tx.user.updateMany({
    where: { id: input.userId, credits: { gte: input.amount } },
    data: { credits: { decrement: input.amount } },
  });
  if (count === 0) throw new AppError('Not enough credits', 402, 'insufficient_credits');
  await applyReferralKickback(tx, input.userId, input.amount);
  return true;
}

// A grant that gives back what a friend spent: a failed job (`*_failed`) or the difference of a
// build rebuilt at a lower quality. It takes the referral kickback back with it.
const isRefundReason = (reason: string) =>
  reason.endsWith('_failed') || reason === 'build_quality_refund';

// A referred friend's net spend pays the referrer a kickback. A spend adds to it and a refund (a
// failed job's `*_failed` grant) takes it back, so the kickback always follows what the friend
// really paid for. A reversal never takes more than the referrer still has.
async function applyReferralKickback(tx: Prisma.TransactionClient, userId: string, change: number) {
  if (change === 0) return;
  const found = await tx.referral.findUnique({ where: { referredUserId: userId } });
  if (found?.status !== 'rewarded' || !found.isKickbackActive) return;
  // Serialize concurrent spends and refunds of this friend, then read the row again.
  await tx.$queryRaw`SELECT id FROM "Referral" WHERE id = ${found.id} FOR UPDATE`;
  const row = await tx.referral.findUniqueOrThrow({ where: { id: found.id } });
  const spent = Math.max(0, row.referredSpent + change);
  const target = Math.floor((spent * REFERRAL_KICKBACK.back) / REFERRAL_KICKBACK.spend);
  let diff = target - row.referrerCredits;
  if (diff < 0) {
    const referrer = await tx.user.findUnique({
      where: { id: row.referrerId },
      select: { credits: true },
    });
    diff = -Math.min(-diff, referrer?.credits ?? 0);
  }
  let seq = row.kickbackSeq;
  if (diff !== 0) {
    const inserted = await tx.creditLedger.createMany({
      data: {
        userId: row.referrerId,
        delta: diff,
        reason: diff > 0 ? 'referral_kickback' : 'referral_kickback_reversed',
        idempotencyKey: `referral:kickback:${row.id}:${seq}`,
      },
      skipDuplicates: true,
    });
    if (!inserted.count) return;
    const { count } = await tx.user.updateMany({
      where: { id: row.referrerId, credits: { gte: -Math.min(diff, 0) } },
      data: { credits: { increment: diff } },
    });
    if (count === 0) throw new AppError('Not enough credits', 402, 'insufficient_credits');
    seq += 1;
  }
  await tx.referral.update({
    where: { id: row.id },
    data: { referredSpent: spent, referrerCredits: row.referrerCredits + diff, kickbackSeq: seq },
  });
}

export async function grantCreditsInTransaction(
  tx: Prisma.TransactionClient,
  input: CreditMutation,
): Promise<boolean> {
  validateAmount(input.amount);
  const inserted = await tx.creditLedger.createMany({
    data: {
      userId: input.userId,
      delta: input.amount,
      reason: input.reason,
      idempotencyKey: input.key,
      renderId: input.renderId,
      purchaseId: input.purchaseId,
    },
    skipDuplicates: true,
  });
  if (!inserted.count) return false;
  await tx.user.update({
    where: { id: input.userId },
    data: { credits: { increment: input.amount } },
  });
  if (isRefundReason(input.reason)) await applyReferralKickback(tx, input.userId, -input.amount);
  return true;
}

// Takes back credits that were granted for a payment that was refunded. It takes at most what the
// wallet still holds, so the balance never goes below zero, and returns how many it took. It is not
// a spend: no API key budget and no referral kickback move with it. A second call with the same key
// takes nothing and returns 0.
export async function reclaimCreditsInTransaction(
  tx: Prisma.TransactionClient,
  input: CreditMutation,
): Promise<number> {
  validateAmount(input.amount);
  // Serialize with concurrent spends and grants of this wallet.
  await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${input.userId} FOR UPDATE`;
  const user = await tx.user.findUnique({ where: { id: input.userId }, select: { credits: true } });
  const taken = Math.min(input.amount, Math.max(0, user?.credits ?? 0));
  if (taken === 0) return 0;
  const inserted = await tx.creditLedger.createMany({
    data: {
      userId: input.userId,
      delta: -taken,
      reason: input.reason,
      idempotencyKey: input.key,
      purchaseId: input.purchaseId,
    },
    skipDuplicates: true,
  });
  if (!inserted.count) return 0;
  await tx.user.update({ where: { id: input.userId }, data: { credits: { decrement: taken } } });
  return taken;
}

// Spends once per idempotency key: a second call with the same key is a no-op.
export async function spendCredits(input: CreditMutation): Promise<void> {
  await db().$transaction((tx) => spendCreditsInTransaction(tx, input));
}

// Grants once per idempotency key. Returns false when the key was already used.
export function grantCredits(input: CreditMutation): Promise<boolean> {
  return db().$transaction((tx) => grantCreditsInTransaction(tx, input));
}

// Charges one agent chat turn. `microCredits` is the turn's cost with the margin, in millionths of a
// credit. It is added to what the user already owes, and the whole credits in the total are spent
// through the ledger (one row, keyed by the turn). The fraction stays on the user. A user who
// cannot cover the whole credits pays what they have: the rest is not carried, so a balance never
// goes below zero and no debt builds up. Returns the whole credits charged.
export async function chargeAgentTurn(input: {
  userId: string;
  key: string;
  microCredits: number;
}): Promise<number> {
  if (!Number.isSafeInteger(input.microCredits) || input.microCredits < 0) {
    throw new AppError('Invalid credit amount', 400, 'invalid_credits');
  }
  const alreadyCharged = new Error('agent turn already charged');
  return db()
    .$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: input.userId },
        data: { agentMicroCredits: { increment: input.microCredits } },
        select: { agentMicroCredits: true, credits: true },
      });
      const owed = Math.floor(user.agentMicroCredits / MICRO_CREDITS_PER_CREDIT);
      const charged = Math.min(owed, user.credits);
      if (charged > 0) {
        const isFirst = await spendCreditsInTransaction(tx, {
          userId: input.userId,
          amount: charged,
          key: input.key,
          reason: 'agent_chat',
        });
        // A repeated turn key rolls the whole charge back, the added fraction included.
        if (!isFirst) throw alreadyCharged;
      }
      await tx.user.update({
        where: { id: input.userId },
        data: { agentMicroCredits: { decrement: owed * MICRO_CREDITS_PER_CREDIT } },
      });
      return charged;
    })
    .catch((error: unknown) => {
      if (error === alreadyCharged) return 0;
      throw error;
    });
}
