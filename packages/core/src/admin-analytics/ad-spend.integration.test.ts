import { db } from '@easyrender/db';
import { afterAll, describe, expect, it } from 'vitest';
import { importAdvertisingSpend } from './ad-spend';

const url = process.env.TEST_DATABASE_URL;
if (url) {
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
    throw new Error('Use local disposable Postgres');
  process.env.DATABASE_URL = url;
}
const accountId = String(Date.now());
const record = {
  platform: 'google_ads',
  accountId,
  campaignId: '123',
  campaignName: 'MCP DE',
  date: '2026-11-01',
  currency: 'EUR',
  costCents: 1000,
  clicks: 10,
  impressions: 100,
};
describe.skipIf(!url)('daily ad spend import persistence', () => {
  afterAll(async () => {
    await db().advertisingSpend.deleteMany({ where: { accountId } });
    await db().$disconnect();
  });
  it('replaces repeat imports and validates the entire batch before any write', async () => {
    expect(await importAdvertisingSpend({ records: [record] })).toEqual({ imported: 1 });
    await importAdvertisingSpend({ records: [{ ...record, costCents: 1200 }] });
    expect(await db().advertisingSpend.findMany({ where: { accountId } })).toMatchObject([
      { costCents: 1200, campaignName: 'mcp de' },
    ]);
    await expect(
      importAdvertisingSpend({
        records: [
          { ...record, costCents: 2000 },
          { ...record, campaignId: '124', costCents: -1 },
        ],
      }),
    ).rejects.toThrow();
    expect(await db().advertisingSpend.findMany({ where: { accountId } })).toMatchObject([
      { costCents: 1200 },
    ]);
  });
});
