import { randomUUID } from 'node:crypto';
import { db } from '@easyrender/db';
import {
  REFERRAL_MAX_REWARDS,
  REFERRAL_REFERRED_CREDITS,
  REFERRAL_REFERRER_CREDITS,
} from '@easyrender/harness';
import { afterAll, describe, expect, it } from 'vitest';
import {
  isReferralCode,
  recordReferral,
  referralCodeFor,
  referralSummary,
  rewardReferral,
} from './referrals';

// Runs against a real Postgres: set TEST_DATABASE_URL (a scratch database with the schema pushed).
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

async function newUser(input: { isVerified?: boolean; email?: string } = {}) {
  const id = `ref-${randomUUID()}`;
  return db().user.create({
    data: {
      id,
      name: id,
      email: input.email ?? `${id}@example.test`,
      emailVerified: input.isVerified ?? true,
    },
  });
}
const balance = async (id: string) =>
  (await db().user.findUniqueOrThrow({ where: { id } })).credits;

describe.skipIf(!url)('referral program', () => {
  afterAll(async () => {
    await db().$disconnect();
  });

  it('issues one stable code to a verified account and none to an unverified one', async () => {
    const verified = await newUser();
    const unverified = await newUser({ isVerified: false });
    const code = await referralCodeFor(verified.id);
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
    expect(await referralCodeFor(verified.id)).toBe(code);
    expect(await referralCodeFor(unverified.id)).toBeNull();
    expect(await isReferralCode(code)).toBe(true);
    expect(await isReferralCode('ZZZZZZZZ')).toBe(false);
  });

  it('pays both sides once, after the new account verifies its email', async () => {
    const referrer = await newUser();
    const code = await referralCodeFor(referrer.id);
    const friend = await newUser({ isVerified: false });
    await recordReferral({ userId: friend.id, code: code?.toLowerCase() });

    expect(await rewardReferral(friend.id)).toBe(false);
    expect(await balance(friend.id)).toBe(0);

    await db().user.update({ where: { id: friend.id }, data: { emailVerified: true } });
    expect(await rewardReferral(friend.id)).toBe(true);
    expect(await rewardReferral(friend.id)).toBe(false);
    await Promise.all([rewardReferral(friend.id), rewardReferral(friend.id)]);

    expect(await balance(friend.id)).toBe(REFERRAL_REFERRED_CREDITS);
    expect(await balance(referrer.id)).toBe(REFERRAL_REFERRER_CREDITS);
    const ledger = await db().creditLedger.findMany({
      where: { userId: { in: [friend.id, referrer.id] } },
    });
    expect(ledger).toHaveLength(2);

    const summary = await referralSummary(referrer.id);
    expect(summary).toMatchObject({
      code,
      rewarded: 1,
      pending: 0,
      creditsEarned: REFERRAL_REFERRER_CREDITS,
    });
  });

  it('refuses a referral to your own mailbox', async () => {
    const referrer = await newUser({ email: `me.${randomUUID()}@gmail.com` });
    const code = await referralCodeFor(referrer.id);
    const alias = await newUser({ email: referrer.email.replace('@', '+again@') });
    await recordReferral({ userId: alias.id, code });
    expect(await rewardReferral(alias.id)).toBe(false);
    expect(await balance(alias.id)).toBe(0);
    expect(await balance(referrer.id)).toBe(0);
    const row = await db().referral.findUniqueOrThrow({ where: { referredUserId: alias.id } });
    expect(row).toMatchObject({ status: 'rejected', rejectReason: 'self_referral' });
  });

  it('ignores an unknown code and keeps the first referrer of an account', async () => {
    const first = await newUser();
    const second = await newUser();
    const friend = await newUser();
    await recordReferral({ userId: friend.id, code: 'ZZZZZZZZ' });
    expect(await db().referral.count({ where: { referredUserId: friend.id } })).toBe(0);
    await recordReferral({ userId: friend.id, code: await referralCodeFor(first.id) });
    await recordReferral({ userId: friend.id, code: await referralCodeFor(second.id) });
    const row = await db().referral.findUniqueOrThrow({ where: { referredUserId: friend.id } });
    expect(row.referrerId).toBe(first.id);
  });

  it('stops paying the referrer after the cap, but the new account still gets its bonus', async () => {
    const referrer = await newUser();
    const code = await referralCodeFor(referrer.id);
    for (let i = 0; i < REFERRAL_MAX_REWARDS + 1; i++) {
      const friend = await newUser();
      await recordReferral({ userId: friend.id, code });
      expect(await rewardReferral(friend.id)).toBe(true);
      expect(await balance(friend.id)).toBe(REFERRAL_REFERRED_CREDITS);
    }
    expect(await balance(referrer.id)).toBe(REFERRAL_REFERRER_CREDITS * REFERRAL_MAX_REWARDS);
  });
});
