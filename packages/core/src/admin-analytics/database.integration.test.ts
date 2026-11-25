import { db } from '@easyrender/db';
import { afterAll, describe, expect, it } from 'vitest';
import { attributionColumns, loadDatabase } from './database';
import { periodRange } from './helpers';
import { buildReport, databaseFinance } from './report';

const url = process.env.TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname))
    throw new Error('Admin integration requires a local scratch database');
  process.env.DATABASE_URL = url;
}
describe.skipIf(!url)('read-only analytics against Postgres', () => {
  afterAll(async () => {
    if (url) await db().$disconnect();
  });
  it('detects deployment columns and produces explicit attribution empty state without them', async () => {
    const columns = await attributionColumns();
    expect(typeof columns.user).toBe('boolean');
    const s = await loadDatabase(false, ['@team.easyrender.test'], { user: false, Render: false });
    expect(s.attribution).toEqual([]);
    expect(s.users.every((u) => !u.email.endsWith('@team.easyrender.test'))).toBe(true);
    const view = buildReport('attribution', s, periodRange({ period: '30d' }), databaseFinance(s), {
      visits: null,
      previousVisits: null,
      uniqueVisitors: null,
      previousUniqueVisitors: null,
      dimensions: {},
    });
    expect(view.notes).toContain('attributionMissing');
    expect(view.tables).toHaveLength(0);
  });
  it('loads only invoiced, credited, non-test Shopify packs as revenue', async () => {
    const id = `analytics-shopify-${crypto.randomUUID()}`;
    await db().user.create({
      data: { id, name: 'Shopify buyer', email: `${id}@example.invalid` },
    });
    const charge = (name: string, fields: Record<string, unknown>) =>
      db().shopifyPurchase.create({
        data: {
          shop: 'analytics.myshopify.com',
          userId: id,
          chargeId: `gid://shopify/AppPurchaseOneTime/${id}-${name}`,
          credits: 2000,
          amountCents: 1900,
          ...fields,
        },
      });
    try {
      const at = new Date();
      await charge('real', { status: 'active', creditedAt: at });
      await charge('test', { status: 'active', isTest: true, creditedAt: at });
      await charge('pending', {});
      await charge('declined', { status: 'declined' });
      const columns = await attributionColumns();
      const s = await loadDatabase(true, [], columns);
      const mine = databaseFinance(s).payments.filter((p) => p.userId === id);
      expect(mine).toEqual([
        expect.objectContaining({ product: 'shopify', gross: 19, currency: 'USD', credits: 2000 }),
      ]);
    } finally {
      await db().user.delete({ where: { id } });
    }
  });
  it('loads deployed attribution without changing schema', async () => {
    const id = `analytics-${crypto.randomUUID()}`;
    await db().user.create({
      data: {
        id,
        name: 'Attribution fixture',
        email: `${id}@example.invalid`,
        utm_campaign: 'integration-check',
        utm_source: 'test',
      },
    });
    try {
      const columns = await attributionColumns();
      const s = await loadDatabase(true, [], columns);
      expect(s.columns).toEqual(columns);
      expect(columns.user).toBe(true);
      // Other suites insert/delete their own users concurrently. Verify our stable fixture,
      // not equality between two global queries made at different instants.
      expect(s.users.find((user) => user.id === id)?.email).toBe(`${id}@example.invalid`);
      expect(s.attribution.find((user) => user.id === id)).toMatchObject({
        utm_campaign: 'integration-check',
        utm_source: 'test',
      });
      expect(await attributionColumns()).toEqual(columns);
      expect(await db().user.findUnique({ where: { id } })).toMatchObject({
        utm_campaign: 'integration-check',
        utm_source: 'test',
      });
    } finally {
      await db().user.delete({ where: { id } });
    }
  });
  it('loads advanced provider estimates once per operation and applies the same team exclusions', async () => {
    const id = `costs-${crypto.randomUUID()}`;
    const email = `${id}@example.invalid`;
    const at = new Date('2032-01-02');
    await db().user.create({ data: { id, name: 'Cost fixture', email } });
    try {
      const render = await db().render.create({
        data: { userId: id, sourceKey: 'fixture', costUsd: 2, createdAt: at },
      });
      const set = await db().viewSet.create({
        data: { userId: id, sourceKey: 'fixture', renderId: render.id, costUsd: 3, createdAt: at },
      });
      const upscale = await db().upscale.create({
        data: {
          userId: id,
          sourceKey: 'fixture',
          viewSetId: set.id,
          kind: 'view',
          scale: 2,
          credits: 100,
          costUsd: 1,
          createdAt: at,
        },
      });
      const included = await loadDatabase(true, [email], { user: false, Render: false });
      expect(included.viewSets.filter((row) => row.id === set.id)).toMatchObject([
        { costUsd: 3, createdAt: at },
      ]);
      expect(included.upscales.filter((row) => row.id === upscale.id)).toMatchObject([
        { costUsd: 1, createdAt: at },
      ]);
      const excluded = await loadDatabase(false, [email], { user: false, Render: false });
      expect(excluded.viewSets.some((row) => row.userId === id)).toBe(false);
      expect(excluded.upscales.some((row) => row.userId === id)).toBe(false);
      const period = periodRange(
        { period: 'custom', from: '2032-01-01', to: '2032-01-03' },
        new Date('2032-01-04'),
        undefined,
        'UTC',
      );
      const scoped = {
        ...included,
        renders: included.renders.filter((row) => row.userId === id),
        viewSets: included.viewSets.filter((row) => row.userId === id),
        upscales: included.upscales.filter((row) => row.userId === id),
      };
      const report = buildReport('overview', scoped, period, databaseFinance(scoped), {
        visits: null,
        previousVisits: null,
        uniqueVisitors: null,
        previousUniqueVisitors: null,
        dimensions: {},
      });
      expect(report.metrics.find((metric) => metric.key === 'providerCost')?.value).toBe(6);
    } finally {
      await db().user.delete({ where: { id } });
    }
  });
});
