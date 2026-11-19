'use server';

import { grantCredits } from '@easyrender/core';
import { isCreditInviteId, normalizedGiftEmail } from '@easyrender/core/credit-gift-policy';
import { db } from '@easyrender/db';
import { requireAdmin } from '@/lib/admin-analytics/auth';
import { MAX_GIFT_CREDITS } from '@/lib/admin-gifts/limits';

async function recipientDetails(email: string) {
  const user = await db().user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, credits: true },
  });
  if (!user) return null;
  const entries = await db().creditLedger.findMany({
    where: { userId: user.id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 5,
    select: { id: true, delta: true, reason: true, createdAt: true },
  });
  return {
    recipient: user,
    ledger: entries.map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() })),
  };
}

export async function findGiftRecipient(value: string) {
  await requireAdmin();
  const email = normalizedGiftEmail(value);
  if (!email) return { status: 'invalid_email' as const };
  const details = await recipientDetails(email);
  if (!details) return { status: 'not_found' as const };
  return { status: 'found' as const, ...details };
}

export async function giftCredits(input: {
  email: string;
  amount: number;
  reason: string;
  key: string;
}) {
  const admin = await requireAdmin();
  if (!admin) throw new Error('Admin session unavailable');
  const email = normalizedGiftEmail(input.email);
  if (!email) return { status: 'invalid_email' as const };
  if (!Number.isInteger(input.amount) || input.amount < 1 || input.amount > MAX_GIFT_CREDITS)
    return { status: 'invalid_amount' as const };
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!reason || reason.length > 500) return { status: 'invalid_reason' as const };
  if (!isCreditInviteId(input.key)) return { status: 'invalid_key' as const };

  const user = await db().user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return { status: 'not_found' as const };
  const key = `admin-gift:${input.key}`;
  const auditReason = `admin_gift:${admin.id}:${reason}`;
  const isGranted = await grantCredits({
    userId: user.id,
    amount: input.amount,
    key,
    reason: auditReason,
  });
  if (isGranted) {
    console.info('admin_credit_gift', {
      adminId: admin.id,
      adminEmail: admin.email,
      targetUserId: user.id,
      targetEmail: email,
      amount: input.amount,
      key,
      reason: auditReason,
    });
  }
  const details = await recipientDetails(email);
  if (!details) return { status: 'not_found' as const };
  return { status: isGranted ? ('granted' as const) : ('duplicate' as const), ...details };
}
