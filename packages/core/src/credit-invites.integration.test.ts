import { randomUUID } from 'node:crypto';
import { db } from '@easyrender/db';
import { RENDER_CREDITS } from '@easyrender/harness';
import { afterAll, describe, expect, it } from 'vitest';
import {
  creditInviteForUser,
  issueCreditInvite,
  issueCreditInviteBatch,
  listCreditInvitePage,
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

async function issue(id: string = randomUUID()) {
  const invite = await issueCreditInvite({
    id,
    issuerId,
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

  it('issues a retriable batch, tracks models across pages, and leaves balances untouched until claim', async () => {
    const campaign = `Studio batch ${run}`;
    const request = {
      id: randomUUID(),
      issuerId,
      amount: RENDER_CREDITS,
      campaign,
      quantity: 53,
    };
    const first = await issueCreditInviteBatch(request);
    expect(first.status).toBe('issued');
    if (first.status !== 'issued') throw Error(first.status);
    expect(new Set(first.ids)).toHaveProperty('size', 53);
    expect(await issueCreditInviteBatch(request)).toEqual(first);
    expect(await issueCreditInviteBatch({ ...request, quantity: 1001 })).toEqual({
      status: 'invalid_quantity',
    });

    const page = await listCreditInvitePage({ campaign, page: 2 });
    expect(page).toMatchObject({ total: 53, page: 2, pages: 2, redeemed: 0, completed: 0 });
    expect(page.invites).toHaveLength(3);
    const invite = page.invites[0];
    if (!invite) throw Error('Missing invitation on page 2');
    const user = await createUser(`batch@${run}.example.test`);
    expect(await db().creditLedger.count({ where: { userId: user.id } })).toBe(0);
    expect(await redeemCreditInvite(invite.id, user.id)).toBe('redeemed');
    await db().render.create({
      data: {
        userId: user.id,
        sourceKey: 'fixture',
        glbKey: 'fixture',
        status: 'ready',
        completedAt: new Date(),
      },
    });
    expect(await listCreditInvitePage({ campaign, page: 1 })).toMatchObject({
      total: 53,
      redeemed: 1,
      completed: 1,
    });
    expect(await listCreditInvitePage({ campaign: 'no-match', page: 9 })).toMatchObject({
      total: 0,
      page: 1,
      invites: [],
    });
  });

  it('issues a unique code without an email and only grants it to one new verified account', async () => {
    const old = await createUser(`old-open@${run}.example.test`, true, new Date(0));
    const id = randomUUID();
    const request = { id, issuerId, amount: RENDER_CREDITS, campaign: 'No email needed' };
    expect(await Promise.all([issueCreditInvite(request), issueCreditInvite(request)])).toEqual([
      { status: 'issued', id },
      { status: 'issued', id },
    ]);
    expect(await redeemCreditInvite(id, old.id)).toBe('unavailable');
    const one = await createUser(`choice-one@${run}.example.test`, false);
    const two = await createUser(`choice-two@${run}.example.test`);
    expect(await redeemCreditInvite(id, one.id)).toBe('unverified');
    await db().user.update({ where: { id: one.id }, data: { emailVerified: true } });
    const results = await Promise.all([
      redeemCreditInvite(id, one.id),
      redeemCreditInvite(id, two.id),
    ]);
    expect(results.sort()).toEqual(['redeemed', 'unavailable']);
    expect(
      await db().creditLedger.count({ where: { idempotencyKey: `credit-invite:${id}` } }),
    ).toBe(1);
    const remaining = await db().creditInvite.findUniqueOrThrow({ where: { id } });
    const listed = (await listCreditInvites()).find((record) => record.id === id);
    expect([one.email, two.email]).toContain(listed?.recipientEmail);
    expect([one.id, two.id]).toContain(remaining.redeemedById);
  });

  it('honors the original recipient on existing email-bound links', async () => {
    const email = `prospect@${run}.example.test`;
    const id = randomUUID();
    await db().creditInvite.create({
      data: {
        id,
        issuerId,
        recipientEmail: email,
        amount: RENDER_CREDITS,
        campaign: 'Legacy',
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
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
    const email = `late@${run}.example.test`;
    const expired = await issue();
    const revoked = await issue();
    expect(await redeemCreditInvite(expired, old.id)).toBe('unavailable');
    await db().creditInvite.update({ where: { id: expired }, data: { expiresAt: new Date(0) } });
    await revokeCreditInvite(revoked);
    const user = await createUser(email);
    expect(await redeemCreditInvite(expired, user.id)).toBe('unavailable');
    expect(await redeemCreditInvite(revoked, user.id)).toBe('unavailable');
    expect(await db().creditLedger.findMany({ where: { userId: user.id } })).toHaveLength(0);
  });

  it('honors only one outreach invitation per account, even on parallel claims', async () => {
    const email = `parallel@${run}.example.test`;
    const a = await issue();
    const b = await issue();
    const user = await createUser(email);
    const attempts = await Promise.all([
      redeemCreditInvite(a, user.id),
      redeemCreditInvite(b, user.id),
    ]);
    expect(attempts.filter((value) => value === 'redeemed')).toHaveLength(1);
    expect(await db().creditLedger.count({ where: { userId: user.id } })).toBe(1);
  });
});
