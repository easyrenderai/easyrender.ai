import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { db } from '@easyrender/db';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eventUuid, setAnalyticsScheduler } from './analytics';
import { reconcileBusinessAnalytics } from './analytics-recovery';
import { capturePurchase } from './billing';

const url = process.env.TEST_DATABASE_URL;
const databaseName = `er_recovery_${crypto.randomUUID().replaceAll('-', '')}`;
const coreDirectory = fileURLToPath(new URL('..', import.meta.url));
const dbDirectory = fileURLToPath(new URL('../../db/', import.meta.url));
let hasDatabase = false;
let isolatedUrl: string | undefined;
if (url) {
  const target = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(target.hostname)) throw new Error('Scratch DB only');
  target.pathname = `/${databaseName}`;
  isolatedUrl = target.toString();
  process.env.DATABASE_URL = isolatedUrl;
}
function scratchDatabase(action: 'CREATE' | 'DROP') {
  // The identifier is generated here, never taken from a URL, user input or production config.
  if (!url || !/^er_recovery_[a-f0-9]+$/.test(databaseName)) throw new Error('Invalid scratch DB');
  execFileSync(
    'bun',
    [
      '--eval',
      `
    import { db } from '@easyrender/db';
    try { await db().$executeRawUnsafe('${action} DATABASE "${databaseName}"'); }
    finally { await db().$disconnect(); }
  `,
    ],
    {
      cwd: coreDirectory,
      env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url },
      stdio: 'pipe',
      timeout: 15000,
    },
  );
}
describe.skipIf(!url)('bounded reconciliation of committed business facts', () => {
  const userId = `reconcile-${crypto.randomUUID()}`;
  const at = new Date(Date.now() - 6 * 86400000);
  beforeAll(async () => {
    scratchDatabase('CREATE');
    hasDatabase = true;
    // A dedicated database is essential: another suite deliberately runs a global queue worker.
    execFileSync('bun', ['run', 'db:push'], {
      cwd: dbDirectory,
      env: { ...process.env, DATABASE_URL: isolatedUrl, DATABASE_URL_UNPOOLED: isolatedUrl },
      stdio: 'pipe',
      timeout: 20000,
    });
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_fake_fixture');
    vi.stubEnv('VERCEL_ENV', 'preview');
    setAnalyticsScheduler(() => undefined);
    await db().user.create({
      data: {
        id: userId,
        name: 'Fixture',
        email: `${userId}@example.invalid`,
        first_seen_at: at.toISOString(),
        utm_campaign: 'original-first-touch',
      },
    });
  }, 30000);
  afterAll(async () => {
    vi.unstubAllEnvs();
    if (hasDatabase) {
      await db().$disconnect();
      scratchDatabase('DROP');
    }
  });
  it('repairs terminal model and preview gaps with original dates, bounded pages and no legacy invention', async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `${userId}-r-${String(i).padStart(2, '0')}`);
    await db().render.createMany({
      data: ids.map((id) => ({
        id,
        userId,
        source: 'mcp',
        sourceKey: 'fixture',
        sheetKey: 'fixture-sheet',
        glbKey: 'fixture-glb',
        status: 'ready',
        createdAt: new Date(+at - 60000),
        completedAt: at,
        previewCompletedAt: at,
      })),
    });
    const legacy = `${userId}-legacy`;
    await db().render.create({
      data: {
        id: legacy,
        userId,
        sourceKey: 'fixture',
        sheetKey: 'fixture',
        glbKey: 'fixture',
        status: 'ready',
      },
    });
    const orphan = `${userId}-orphan`;
    await db().render.create({
      data: {
        id: orphan,
        sourceKey: 'fixture',
        completedAt: at,
        previewCompletedAt: at,
        status: 'ready',
      },
    });
    await reconcileBusinessAnalytics();
    expect(await db().posthogDelivery.count({ where: { subjectId: orphan } })).toBe(0);
    expect(await db().posthogDelivery.count({ where: { userId, event: 'render_ready' } })).toBe(50);
    await reconcileBusinessAnalytics();
    expect(await db().posthogDelivery.count({ where: { userId, event: 'render_ready' } })).toBe(51);
    expect(await db().posthogDelivery.count({ where: { userId, event: 'preview_ready' } })).toBe(
      51,
    );
    expect(
      await db().posthogDelivery.findUnique({ where: { id: eventUuid(`render_ready:${ids[0]}`) } }),
    ).toMatchObject({
      occurredAt: at,
      properties: { source_channel: 'mcp', ft_utm_campaign: 'original-first-touch' },
    });
    expect(await db().posthogDelivery.count({ where: { subjectId: legacy } })).toBe(0);
  });
  it('recovers paid purchase events without a Stripe replay or a new credit grant', async () => {
    const purchase = await db().purchase.create({
      data: {
        userId,
        stripeSessionId: `${userId}-session`,
        packId: 'payg',
        credits: 500,
        amountCents: 1234,
        currency: 'eur',
        status: 'paid',
        paidAt: at,
      },
    });
    await reconcileBusinessAnalytics();
    expect(
      await db().posthogDelivery.findUnique({
        where: { id: eventUuid(`purchase:${purchase.id}`) },
      }),
    ).toMatchObject({
      occurredAt: at,
      properties: { amount: 12.34, currency: 'EUR', ft_utm_campaign: 'original-first-touch' },
    });
    expect(await db().creditLedger.count({ where: { userId } })).toBe(0);
  });
  it('orders first purchase by actual paid time and uses the persisted charged currency', async () => {
    const buyer = `${userId}-ordered`;
    await db().user.create({
      data: { id: buyer, name: 'Fixture', email: `${buyer}@example.invalid` },
    });
    const later = await db().purchase.create({
      data: {
        userId: buyer,
        stripeSessionId: `${buyer}-late`,
        packId: 'payg',
        credits: 500,
        amountCents: 500,
        currency: 'eur',
        status: 'paid',
        createdAt: new Date(0),
        paidAt: new Date(),
      },
    });
    const first = await db().purchase.create({
      data: {
        userId: buyer,
        stripeSessionId: `${buyer}-first`,
        packId: 'payg',
        credits: 500,
        amountCents: 500,
        currency: 'usd',
        status: 'paid',
        createdAt: new Date(Date.now() - 3600000),
        paidAt: new Date(Date.now() - 1800000),
      },
    });
    await capturePurchase(later.id, true);
    await capturePurchase(first.id, true);
    expect(
      await db().posthogDelivery.findUnique({ where: { id: eventUuid(`purchase:${later.id}`) } }),
    ).toMatchObject({ properties: { is_first_purchase: false, currency: 'EUR' } });
    expect(
      await db().posthogDelivery.findUnique({ where: { id: eventUuid(`purchase:${first.id}`) } }),
    ).toMatchObject({ properties: { is_first_purchase: true, currency: 'USD' } });
  });
  it('does not invent a purchase event time for an undated legacy paid row', async () => {
    const purchase = await db().purchase.create({
      data: {
        userId,
        stripeSessionId: `${userId}-legacy-purchase`,
        packId: 'payg',
        credits: 500,
        amountCents: 500,
        currency: 'eur',
        status: 'paid',
      },
    });
    await capturePurchase(purchase.id, true);
    expect(
      await db().posthogDelivery.findUnique({
        where: { id: eventUuid(`purchase:${purchase.id}`) },
      }),
    ).toBeNull();
  });
});
