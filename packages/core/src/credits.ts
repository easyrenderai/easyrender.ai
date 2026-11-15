import { db, type Prisma } from '@easyrender/db';
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
  const { count } = await tx.user.updateMany({
    where: { id: input.userId, credits: { gte: input.amount } },
    data: { credits: { decrement: input.amount } },
  });
  if (count === 0) throw new AppError('Not enough credits', 402, 'insufficient_credits');
  return true;
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
  return true;
}

// Spends once per idempotency key: a second call with the same key is a no-op.
export async function spendCredits(input: CreditMutation): Promise<void> {
  await db().$transaction((tx) => spendCreditsInTransaction(tx, input));
}

// Grants once per idempotency key. Returns false when the key was already used.
export function grantCredits(input: CreditMutation): Promise<boolean> {
  return db().$transaction((tx) => grantCreditsInTransaction(tx, input));
}
