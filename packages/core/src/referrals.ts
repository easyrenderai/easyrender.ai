import { randomInt } from 'node:crypto';
import { db, type Prisma } from '@easyrender/db';
import { REFERRAL_MAX_REWARDS, REFERRAL_REFERRED_CREDITS } from '@easyrender/harness';
import { config } from './config';
import { grantCreditsInTransaction } from './credits';
import { ALPHABET, CODE_LENGTH, normalizeReferralCode } from './referral-code';
import { reportError } from './report';

/** Collapses the aliases of one mailbox (dots and +tags at Gmail, +tags elsewhere). */
export function mailboxKey(email: string): string {
  const [rawLocal = '', rawDomain = ''] = email.trim().toLowerCase().split('@');
  const domain = rawDomain === 'googlemail.com' ? 'gmail.com' : rawDomain;
  const local = rawLocal.split('+')[0] ?? '';
  return `${domain === 'gmail.com' ? local.replaceAll('.', '') : local}@${domain}`;
}

const newCode = () =>
  Array.from({ length: CODE_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

/** The share code of a verified account, issued on first use. Unverified accounts get none. */
export async function referralCodeFor(userId: string): Promise<string | null> {
  const user = await db().user.findUnique({
    where: { id: userId },
    select: { referralCode: true, emailVerified: true },
  });
  if (!user?.emailVerified) return null;
  if (user.referralCode) return user.referralCode;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    try {
      const { count } = await db().user.updateMany({
        where: { id: userId, referralCode: null },
        data: { referralCode: code },
      });
      if (count) return code;
      const again = await db().user.findUnique({
        where: { id: userId },
        select: { referralCode: true },
      });
      if (again?.referralCode) return again.referralCode;
    } catch {
      // A collision on the unique index: draw another code.
    }
  }
  return null;
}

export const referralLink = (code: string) =>
  `${config.appUrl()}/sign-up?ref=${encodeURIComponent(code)}`;

/** True when the code belongs to an account, so the sign up form shows it as applied. */
export async function isReferralCode(raw: unknown): Promise<boolean> {
  const code = normalizeReferralCode(raw);
  if (!code) return false;
  return Boolean(
    await db().user.findUnique({ where: { referralCode: code }, select: { id: true } }),
  );
}

/**
 * Called when an account is created. Remembers who brought it in; pays nothing yet. A code that
 * does not exist, or that belongs to the same mailbox, never blocks sign up.
 */
export async function recordReferral(input: { userId: string; code: unknown }): Promise<void> {
  const code = normalizeReferralCode(input.code);
  if (!code) return;
  try {
    const referrer = await db().user.findUnique({
      where: { referralCode: code },
      select: { id: true, email: true },
    });
    if (!referrer) return;
    const user = await db().user.findUnique({
      where: { id: input.userId },
      select: { email: true },
    });
    if (!user) return;
    const isSelf =
      referrer.id === input.userId || mailboxKey(referrer.email) === mailboxKey(user.email);
    await db().referral.createMany({
      data: {
        code,
        referrerId: referrer.id,
        referredUserId: input.userId,
        status: isSelf ? 'rejected' : 'pending',
        rejectReason: isSelf ? 'self_referral' : null,
      },
      skipDuplicates: true,
    });
  } catch {
    // A referral must never prevent account creation.
    reportError(new Error('Unable to record referral'), { component: 'referral' });
  }
}

/**
 * Pays the new account's bonus once its email is verified, and starts the referrer's kickback. Safe to call on every
 * verification and sign in: the status flip and the ledger keys make a second call a no-op.
 */
export async function rewardReferral(userId: string): Promise<boolean> {
  try {
    return await db().$transaction(async (tx) => {
      const referral = await tx.referral.findUnique({ where: { referredUserId: userId } });
      if (referral?.status !== 'pending') return false;
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { emailVerified: true },
      });
      if (!user?.emailVerified) return false;
      await lockReferrer(tx, referral.referrerId);
      const rewarded = await tx.referral.count({
        where: { referrerId: referral.referrerId, status: 'rewarded' },
      });
      const { count } = await tx.referral.updateMany({
        where: { id: referral.id, status: 'pending' },
        data: {
          status: 'rewarded',
          rewardedAt: new Date(),
          referredCredits: REFERRAL_REFERRED_CREDITS,
          // The referrer's kickback on this friend's spend, up to the cap of friends.
          isKickbackActive: rewarded < REFERRAL_MAX_REWARDS,
        },
      });
      if (!count) return false;
      await grantCreditsInTransaction(tx, {
        userId,
        amount: REFERRAL_REFERRED_CREDITS,
        key: `referral:referred:${referral.id}`,
        reason: 'referral_welcome',
      });
      return true;
    });
  } catch {
    reportError(new Error('Unable to reward referral'), { component: 'referral' });
    return false;
  }
}

async function lockReferrer(tx: Prisma.TransactionClient, referrerId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`referral:${referrerId}`}, 0))`;
}

export type ReferralSummary = {
  code: string | null;
  link: string | null;
  rewarded: number;
  pending: number;
  creditsEarned: number;
};

/** What the account page shows: the share link and how it has done. */
export async function referralSummary(userId: string): Promise<ReferralSummary> {
  const code = await referralCodeFor(userId);
  const rows = await db().referral.findMany({
    where: { referrerId: userId, status: { in: ['pending', 'rewarded'] } },
    select: { status: true, referrerCredits: true },
  });
  return {
    code,
    link: code ? referralLink(code) : null,
    rewarded: rows.filter((row) => row.status === 'rewarded').length,
    pending: rows.filter((row) => row.status === 'pending').length,
    creditsEarned: rows.reduce((sum, row) => sum + row.referrerCredits, 0),
  };
}

/** The bonus a new account is promised on the sign up form. */
export const referralBonusCredits = () => REFERRAL_REFERRED_CREDITS;
