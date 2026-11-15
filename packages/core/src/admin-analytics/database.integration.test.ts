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
});
