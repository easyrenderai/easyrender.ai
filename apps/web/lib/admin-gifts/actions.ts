'use server';

import { grantCredits } from '@easyrender/core';
import { db } from '@easyrender/db';
import { requireAdmin } from '@/lib/admin-analytics/auth';

const MAX_GIFT_CREDITS = 10_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizedEmail(value: string): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

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
  const email = normalizedEmail(value);
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
  const email = normalizedEmail(input.email);
  if (!email) return { status: 'invalid_email' as const };
  if (!Number.isInteger(input.amount) || input.amount < 1 || input.amount > MAX_GIFT_CREDITS)
    return { status: 'invalid_amount' as const };
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!reason || reason.length > 500) return { status: 'invalid_reason' as const };
  if (typeof input.key !== 'string' || !KEY_PATTERN.test(input.key))
    return { status: 'invalid_key' as const };

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
