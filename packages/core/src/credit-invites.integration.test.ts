import { randomUUID } from 'node:crypto';
import { db } from '@easyrender/db';
import { RENDER_CREDITS } from '@easyrender/harness';
import { afterAll, describe, expect, it } from 'vitest';
import {
  creditInviteForUser,
  issueCreditInvite,
  listCreditInvites,
  redeemCreditInvite,
  revokeCreditInvite,
} from './credit-invites';

const scratch = process.env.TEST_DATABASE_URL;
if (scratch) {
  if (!['127.0.0.1', 'localhost'].includes(new URL(scratch).hostname))
    throw new Error('Use a local scratch database');
  process.env.DATABASE_URL = scratch;
}
const run = randomUUID();
const issuerId = `outreach-admin-${run}`;

async function createUser(email: string, isVerified = true, createdAt = new Date()) {
  return db().user.create({
    data: { id: randomUUID(), name: 'Recipient', email, emailVerified: isVerified, createdAt },
  });
}

async function issue(email: string, id: string = randomUUID()) {
  const invite = await issueCreditInvite({
    id,
    issuerId,
    email,
    amount: RENDER_CREDITS,
    campaign: 'Product demo',
  });
  if (invite.status !== 'issued') throw Error(invite.status);
  return invite.id;
}

describe.skipIf(!scratch)('outreach credit invites with scratch Postgres', () => {
  afterAll(async () => {
    await db().creditInvite.deleteMany({ where: { issuerId } });
    await db().user.deleteMany({ where: { email: { endsWith: `@${run}.example.test` } } });
    await db().$disconnect();
  });

  it('issues before signup, preserves an identical retry and grants once to the intended verified user', async () => {
    const email = `prospect@${run}.example.test`;
    const id = randomUUID();
    expect(await Promise.all([issue(email, id), issue(email, id)])).toEqual([id, id]);
    const wrong = await createUser(`wrong@${run}.example.test`);
    const user = await createUser(email, false);
    expect(await creditInviteForUser(id, wrong.id)).toBeNull();
    expect(await redeemCreditInvite(id, wrong.id)).toBe('unavailable');
    expect(await redeemCreditInvite(id, user.id)).toBe('unverified');
    await db().user.update({ where: { id: user.id }, data: { emailVerified: true } });
    const attempts = await Promise.all([
      redeemCreditInvite(id, user.id),
      redeemCreditInvite(id, user.id),
    ]);
    expect(attempts.sort()).toEqual(['redeemed', 'used']);
    const updated = await db().user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.credits).toBe(RENDER_CREDITS);
    expect(await db().creditLedger.findMany({ where: { userId: user.id } })).toMatchObject([
      { idempotencyKey: `credit-invite:${id}`, delta: RENDER_CREDITS },
    ]);
    const row = (await listCreditInvites()).find((record) => record.id === id);
    expect(row).toMatchObject({ status: 'redeemed', firstModelAt: null });
    await db().render.create({
      data: {
        userId: user.id,
        sourceKey: 'fixture',
        glbKey: 'fixture',
        status: 'ready',
        completedAt: new Date(),
      },
    });
    expect(
      (await listCreditInvites()).find((record) => record.id === id)?.firstModelAt,
    ).toBeInstanceOf(Date);
  });

  it('rejects expired and revoked links and does not mint credits for an existing account', async () => {
    const old = await createUser(`old@${run}.example.test`, true, new Date(0));
    await expect(
      issueCreditInvite({
        id: randomUUID(),
        issuerId,
        email: old.email,
        amount: RENDER_CREDITS,
        campaign: 'Already known',
      }),
    ).resolves.toEqual({ status: 'existing_account' });
    const email = `late@${run}.example.test`;
    const expired = await issue(email);
    const revoked = await issue(email);
    await db().creditInvite.update({ where: { id: expired }, data: { expiresAt: new Date(0) } });
    await revokeCreditInvite(revoked);
    const user = await createUser(email);
    expect(await redeemCreditInvite(expired, user.id)).toBe('unavailable');
    expect(await redeemCreditInvite(revoked, user.id)).toBe('unavailable');
    expect(await db().creditLedger.findMany({ where: { userId: user.id } })).toHaveLength(0);
  });

  it('honors only one outreach invitation per account, even on parallel claims', async () => {
    const email = `parallel@${run}.example.test`;
    const a = await issue(email);
    const b = await issue(email);
    const user = await createUser(email);
    const attempts = await Promise.all([
      redeemCreditInvite(a, user.id),
      redeemCreditInvite(b, user.id),
    ]);
    expect(attempts.filter((value) => value === 'redeemed')).toHaveLength(1);
    expect(await db().creditLedger.count({ where: { userId: user.id } })).toBe(1);
  });
});
