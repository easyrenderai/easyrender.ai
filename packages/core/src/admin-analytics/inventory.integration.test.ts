import { randomUUID } from 'node:crypto';
import { db } from '@easyrender/db';
import { afterAll, describe, expect, it } from 'vitest';
import { grantCredits, spendCredits } from '../credits';
import { loadBuyers } from './buyers';
import { loadAdminRenders, renderFilters } from './renders';

const scratch = process.env.TEST_DATABASE_URL;
if (scratch) {
  if (!['localhost', '127.0.0.1'].includes(new URL(scratch).hostname))
    throw new Error('Use a local scratch database');
  process.env.DATABASE_URL = scratch;
}
const run = randomUUID();
const userId = `inventory-${run}`;

it('normalizes pagination and filters instead of passing untrusted values into Prisma', () => {
  expect(renderFilters('-1', 'not-a-status')).toEqual({ page: 1, status: undefined });
  expect(renderFilters('NaN', 'ready')).toEqual({ page: 1, status: 'ready' });
  expect(renderFilters('2', 'failed')).toEqual({ page: 2, status: 'failed' });
  expect(renderFilters('1.5')).toEqual({ page: 1, status: undefined });
});

describe.skipIf(!scratch)('admin inventory on scratch Postgres', () => {
  afterAll(async () => {
    await db().render.deleteMany({ where: { userId } });
    await db().user.deleteMany({ where: { id: userId } });
    await db().$disconnect();
  });
  it('reads paid purchases and a real ledger without changing wallet or generation state', async () => {
    await db().user.create({
      data: {
        id: userId,
        name: 'Fixture buyer',
        email: `john-${run}@example.test`,
        emailVerified: true,
      },
    });
    const purchase = await db().purchase.create({
      data: {
        userId,
        stripeSessionId: `fixture-${run}`,
        packId: 'fixture',
        credits: 500,
        amountCents: 800,
        currency: 'eur',
        status: 'paid',
        paidAt: new Date('2026-11-15'),
      },
    });
    await grantCredits({
      userId,
      key: `purchase-${run}`,
      amount: 500,
      reason: 'purchase',
      purchaseId: purchase.id,
    });
    await grantCredits({
      userId,
      key: `gift-${run}`,
      amount: 100,
      reason: 'outreach_credit_invite',
    });
    await spendCredits({ userId, key: `spend-${run}`, amount: 60, reason: 'render' });
    await grantCredits({ userId, key: `refund-${run}`, amount: 60, reason: 'render_failed' });
    await db().render.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        id: `${run}-${String(i).padStart(2, '0')}`,
        userId,
        status: 'ready',
        sourceKey: 'local:fixture.png',
        sheetKey: 'local:sheet.png',
        glbKey: 'local:fixture.glb',
        createdAt: new Date('2199-01-01'),
      })),
    });
    const before = await db().user.findUniqueOrThrow({ where: { id: userId } });
    const rendersBefore = await db().render.findMany({ where: { userId }, orderBy: { id: 'asc' } });
    const buyer = (await loadBuyers()).find((row) => row.id === userId);
    expect(buyer).toMatchObject({
      email: 'jo***@e***.test',
      purchases: 1,
      purchased: 500,
      gifted: 100,
      used: 60,
      refunded: 60,
      remaining: 600,
      amounts: { EUR: 800 },
    });
    const first = await loadAdminRenders('1', 'ready');
    const second = await loadAdminRenders('2', 'ready');
    expect(first.renders).toHaveLength(24);
    const fixtureRows = [...first.renders, ...second.renders].filter((row) =>
      row.id.startsWith(run),
    );
    expect(fixtureRows.map((row) => row.id)).toEqual(rendersBefore.map((row) => row.id).reverse());
    expect(
      fixtureRows.every(
        (row) => row.email === 'jo***@e***.test' && row.hasModel && row.hasSheet && row.hasSource,
      ),
    ).toBe(true);
    expect(JSON.stringify(first)).not.toContain('local:');
    expect(JSON.stringify(first)).not.toContain(`john-${run}`);
    expect(await db().user.findUniqueOrThrow({ where: { id: userId } })).toEqual(before);
    expect(await db().render.findMany({ where: { userId }, orderBy: { id: 'asc' } })).toEqual(
      rendersBefore,
    );
    expect((await loadAdminRenders('999999')).page).toBe((await loadAdminRenders()).pages);
  });
});
