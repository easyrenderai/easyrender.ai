import { describe, expect, it } from 'vitest';
import { advertisingTable, parseSpendImport } from './ad-spend';
import { periodRange } from './helpers';

const row = {
  date: '2026-11-01',
  platform: 'google_ads',
  accountId: '1234567890',
  campaignId: '42',
  campaignName: 'MCP DE',
  currency: 'EUR',
  costCents: 1000,
  clicks: 8,
  impressions: 80,
};
const range = periodRange(
  { period: 'custom', from: '2026-11-01', to: '2026-11-02' },
  new Date('2026-11-04'),
  undefined,
  'UTC',
);
const payments = [
  { userId: 'new', at: '2026-11-02T01:00Z', currency: 'EUR', gross: 10 },
  { userId: 'new', at: '2026-11-02T02:00Z', currency: 'EUR', gross: 10 },
  { userId: 'old', at: '2026-10-01T02:00Z', currency: 'EUR', gross: 10 },
  { userId: 'old', at: '2026-11-02T02:00Z', currency: 'EUR', gross: 10 },
];
const attribution = ['new', 'old'].map((id) => ({
  id,
  utm_source: 'google',
  utm_medium: 'cpc',
  utm_campaign: 'mcp de',
}));
const spends = [row, { ...row, date: '2026-11-02', costCents: 2000 }].map((r) => ({
  ...r,
  date: new Date(r.date),
  importedAt: new Date('2026-11-03'),
}));

describe('manual Ads spend', () => {
  it('validates bounded exact calendar dates and nonnegative whole counters before writing', () => {
    expect(parseSpendImport({ records: [row] })).toMatchObject([
      { ...row, campaignName: 'mcp de', date: new Date(row.date) },
    ]);
    for (const invalid of [
      { date: '2026-02-30' },
      { costCents: -1 },
      { costCents: 1.1 },
      { clicks: 2 ** 40 },
      { platform: 'unknown' },
      { currency: 'ZZZ' },
      { campaignName: ' ' },
    ])
      expect(() => parseSpendImport({ records: [{ ...row, ...invalid }] })).toThrow();
    expect(() => parseSpendImport({ records: Array(1001).fill(row) })).toThrow();
    expect(() => parseSpendImport({ records: [row, row] })).toThrow();
  });
  it('counts first-ever payers once, matches paid Google campaign and currency, and exposes import coverage', () => {
    const result = advertisingTable(spends, payments, attribution, range);
    expect(result.rows).toEqual([
      expect.objectContaining({
        campaign: 'mcp de',
        currency: 'EUR',
        adSpend: 30,
        importedDays: 2,
        expectedDays: 2,
        newPayers: 1,
        cacEstimate: 30,
        spendCoverage: 'spendComplete',
      }),
    ]);
  });
  it('keeps missing spend unknown and refuses CAC for partial imports or ambiguous campaign identities', () => {
    expect(advertisingTable([], payments, attribution, range).rows[0]).toMatchObject({
      adSpend: null,
      newPayers: 1,
      cacEstimate: null,
      spendCoverage: 'spendMissing',
    });
    expect(
      advertisingTable(spends.slice(0, 1), payments, attribution, range).rows[0],
    ).toMatchObject({ adSpend: 10, cacEstimate: null, spendCoverage: 'spendPartial' });
    const ambiguous = [...spends, ...spends.map((r) => ({ ...r, accountId: '999' }))];
    expect(advertisingTable(ambiguous, payments, attribution, range).rows[0]).toMatchObject({
      adSpend: 60,
      newPayers: null,
      cacEstimate: null,
      spendCoverage: 'spendAmbiguous',
    });
  });
  it('does not match organic, non-Google, unknown attribution or a different payment currency', () => {
    const attrs = attribution.map((a) => ({ ...a, utm_medium: 'organic' }));
    expect(advertisingTable(spends, payments, attrs, range).rows[0]).toMatchObject({
      newPayers: 0,
      cacEstimate: null,
    });
    expect(
      advertisingTable(
        spends,
        payments,
        attribution.map((a) => ({ ...a, utm_source: 'bing' })),
        range,
      ).rows[0],
    ).toMatchObject({ newPayers: 0, cacEstimate: null });
    const result = advertisingTable(
      spends,
      payments.map((p) => ({ ...p, currency: 'USD' })),
      attribution,
      range,
    );
    expect(result.rows.find((r) => r.currency === 'EUR')).toMatchObject({
      newPayers: 0,
      cacEstimate: null,
    });
    expect(result.rows.find((r) => r.currency === 'USD')).toMatchObject({
      newPayers: 1,
      adSpend: null,
    });
  });
});

it('keeps an imported current local day provisional across the Madrid DST boundary', () => {
  const dstRange = periodRange(
    { period: 'custom', from: '2026-10-25', to: '2026-10-25' },
    new Date('2026-11-04'),
    undefined,
    'Europe/Madrid',
  );
  const spend = [
    {
      ...row,
      date: new Date('2026-10-25'),
      costCents: 1000,
      importedAt: new Date('2026-10-25T22:30Z'),
    },
  ];
  const payer = [{ userId: 'new', at: '2026-10-25T12:00Z', currency: 'EUR', gross: 10 }];
  expect(
    advertisingTable(spend, payer, attribution, dstRange, new Date('2026-10-25T22:30Z')).rows[0],
  ).toMatchObject({
    importedDays: 1,
    expectedDays: 1,
    cacEstimate: null,
    spendCoverage: 'spendProvisional',
  });
  expect(
    advertisingTable(spend, payer, attribution, dstRange, new Date('2026-10-25T23:30Z')).rows[0],
  ).toMatchObject({ cacEstimate: null, spendCoverage: 'spendProvisional' });
  const closedImport = spend.map((r) => ({ ...r, importedAt: new Date('2026-10-25T23:15Z') }));
  expect(
    advertisingTable(closedImport, payer, attribution, dstRange, new Date('2026-10-25T23:30Z'))
      .rows[0],
  ).toMatchObject({ cacEstimate: 10, spendCoverage: 'spendComplete' });
});
it('distinguishes explicit complete zero spend from a missing import', () => {
  const zeros = spends.map((r) => ({ ...r, costCents: 0 }));
  expect(advertisingTable(zeros, payments, attribution, range).rows[0]).toMatchObject({
    adSpend: 0,
    cacEstimate: 0,
    spendCoverage: 'spendComplete',
  });
  expect(advertisingTable([], payments, attribution, range).rows[0]).toMatchObject({
    adSpend: null,
    cacEstimate: null,
    spendCoverage: 'spendMissing',
  });
});

it('keeps campaign-name collisions ambiguous even across different account currencies', () => {
  const otherAccount = spends.map((r) => ({ ...r, accountId: '999', currency: 'USD' }));
  const rows = advertisingTable([...spends, ...otherAccount], payments, attribution, range).rows;
  expect(rows.find((row) => row.currency === 'EUR')).toMatchObject({
    newPayers: null,
    cacEstimate: null,
    spendCoverage: 'spendAmbiguous',
  });
});
