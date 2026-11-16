import { db } from '@easyrender/db';
import { afterAll, describe, expect, it } from 'vitest';
import { loadDatabase } from './database';
import { periodRange } from './helpers';
import { buildReport, databaseFinance } from './report';

const url = process.env.TEST_DATABASE_URL;
if (url) {
  if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname))
    throw new Error('Use a local disposable database');
  process.env.DATABASE_URL = url;
}
const userId = `activation_${crypto.randomUUID()}`;
const email = `${userId}@activation-qa.invalid`;
describe.skipIf(!url)('stored activation admin report', () => {
  afterAll(async () => {
    await db().user.deleteMany({ where: { id: userId } });
    await db().$disconnect();
  });
  it('reads true completion cohorts from Postgres and honors existing team exclusions', async () => {
    await db().user.create({ data: { id: userId, name: 'QA', email } });
    await db().render.createMany({
      data: [1, 2].map((index) => ({
        userId,
        source: 'mcp',
        sourceKey: 'fixture:source',
        status: 'ready' as const,
        glbKey: 'fixture:model',
        createdAt: new Date('2030-01-01T00:00Z'),
        completedAt: new Date(`2030-01-0${index}T01:00Z`),
        updatedAt: new Date('2030-12-01'),
      })),
    });
    const excluded = await loadDatabase(false, [email], { user: false, Render: false });
    expect(excluded.renders.some((render) => render.userId === userId)).toBe(false);
    const snapshot = await loadDatabase(true, [email], { user: false, Render: false });
    expect(snapshot.renders.filter((render) => render.userId === userId)).toHaveLength(2);
    const range = periodRange(
      { period: 'custom', from: '2030-01-01', to: '2030-01-07' },
      new Date('2030-01-08'),
      undefined,
      'UTC',
    );
    expect(range.start).toBe('2030-01-01T00:00:00.000Z');
    const report = buildReport('product', snapshot, range, databaseFinance(snapshot), {
      visits: null,
      uniqueVisitors: null,
      previousVisits: null,
      previousUniqueVisitors: null,
      dimensions: {},
    });
    expect(
      report.tables
        .find((table) => table.key === 'developerActivation')
        ?.rows.find((row) => row.source === 'mcp'),
    ).toMatchObject({
      activationAccounts: 1,
      firstSuccess: 1,
      secondSuccess: 1,
      firstSuccessMinutes: 60,
      repeatMinutes: 1440,
    });
    expect(
      JSON.stringify(report.tables.filter((table) => table.key.startsWith('developerActivation'))),
    ).not.toContain(email);
    expect(
      JSON.stringify(report.tables.filter((table) => table.key.startsWith('developerActivation'))),
    ).not.toContain(userId);
  });
});
