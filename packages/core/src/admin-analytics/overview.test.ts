import { describe, expect, it } from 'vitest';
import { periodRange } from './helpers';
import { buildOverviewSeries } from './overview';

const range = periodRange(
  { period: 'custom', from: '2026-03-28', to: '2026-03-30' },
  new Date('2026-11-11T12:00:00Z'),
);
const input: Parameters<typeof buildOverviewSeries>[0] = {
  range,
  currency: 'USD',
  users: [],
  renders: [],
  payments: [],
  posthog: {
    health: {
      configured: true,
      error: null,
      isTruncated: false,
      missing: [],
      fetchedAt: null,
      rowCount: 0,
    },
    series: [],
  },
};
const pay = (userId: string | null, at = '2026-03-28T12:00:00Z', gross = 10, currency = 'USD') => ({
  userId,
  at,
  gross,
  currency,
});
const render = (
  fields: Partial<(typeof input.renders)[number]> = {},
): (typeof input.renders)[number] => ({
  userId: 'a',
  createdAt: new Date('2026-03-28T12:00:00Z'),
  sheetKey: 'sheet',
  glbKey: 'model',
  status: 'ready',
  completedAt: new Date('2026-03-28T12:10:00Z'),
  previewCompletedAt: new Date('2026-03-28T12:05:00Z'),
  ...fields,
});

describe('overview time series', () => {
  it('fills every local bucket with zero and recognizes an empty report', () => {
    const result = buildOverviewSeries(input);
    expect(result.hasData).toBe(false);
    expect(result.heading).toBe('overviewPerDay');
    expect(result.rows).toEqual(
      ['2026-03-28', '2026-03-29', '2026-03-30'].map((date) => ({
        date,
        visits: 0,
        payingCustomers: 0,
        uses: 0,
        sheets: 0,
        models: 0,
        revenue: 0,
        newSignups: 0,
      })),
    );
  });
  it('counts distinct identified payers each day, across currencies; sums gross in the selected currency', () => {
    const result = buildOverviewSeries({
      ...input,
      payments: [
        pay('a'),
        pay('a'),
        pay('b', undefined, 7),
        pay(null),
        pay('c', undefined, 80, 'EUR'),
        pay('a', '2026-03-29T12:00:00Z', 5),
      ],
    });
    expect(result.rows[0]).toMatchObject({ payingCustomers: 3, revenue: 37 });
    expect(result.rows[1]).toMatchObject({ payingCustomers: 1, revenue: 5 });
    expect(result.hasData).toBe(true);
    expect(
      buildOverviewSeries({ ...input, payments: [pay('a'), pay('a')] }).rows[0].payingCustomers,
    ).toBe(1);
    expect(
      buildOverviewSeries({ ...input, payments: [pay('a'), pay('a'), pay('b')] }).rows[0]
        .payingCustomers,
    ).toBe(2);
  });
  it('counts creation-dated sheets and immutable model successes, including anonymous sheets', () => {
    const result = buildOverviewSeries({
      ...input,
      renders: [
        render(),
        render({ status: 'rendering', completedAt: null }),
        render({ sheetKey: null, previewCompletedAt: null }),
        render({ userId: null, status: 'preview_ready', glbKey: null, completedAt: null }),
        render({ createdAt: new Date(range.end) }),
      ],
    });
    expect(result.rows[0]).toMatchObject({ sheets: 3, models: 2, uses: 5 });
    expect(result.rows.slice(1).every((r) => r.uses === 0)).toBe(true);
  });
  it('excludes team payments, uses and signups, while retaining anonymous activity and unfiltered visits', () => {
    const scoped = {
      ...input,
      exclusions: ['@team.test'],
      users: [{ id: 'a', email: 'a@team.test', createdAt: new Date('2026-03-28T12:00:00Z') }],
      payments: [pay('a'), pay('b')],
      renders: [render(), render({ userId: null })],
    };
    expect(buildOverviewSeries(scoped).rows[0]).toMatchObject({
      payingCustomers: 1,
      revenue: 10,
      uses: 2,
      newSignups: 0,
    });
    expect(
      buildOverviewSeries({ ...scoped, range: { ...range, includeTeam: true } }).rows[0],
    ).toMatchObject({ payingCustomers: 2, revenue: 20, uses: 4, newSignups: 1 });
  });
  it.each([
    [{ configured: false }, 'visitsNotConfigured'],
    [{ error: 'upstream' }, 'visitsError'],
    [{ isTruncated: true }, 'visitsIncomplete'],
  ] as const)('withholds all visits when PostHog health is %j', (health, note) => {
    const result = buildOverviewSeries({
      ...input,
      payments: [pay('a')],
      posthog: {
        health: { ...input.posthog.health, ...health },
        series: [{ date: '2026-03-28', visits: 12, pageviews: 30, uniqueVisitors: 8 }],
      },
    });
    expect(result.visitsNote).toBe(note);
    expect(result.rows.every((r) => r.visits === null)).toBe(true);
    expect(result.rows[0].revenue).toBe(10);
  });
  it('aligns PostHog local dates with DB instants over midnight and DST, excluding the end instant', () => {
    const result = buildOverviewSeries({
      ...input,
      payments: [
        pay('a', range.start),
        pay('b', '2026-03-29T21:59:59Z'),
        pay('c', '2026-03-29T22:00:00Z'),
        pay('d', range.end),
      ],
      posthog: {
        ...input.posthog,
        series: [{ date: '2026-03-30', visits: 7, pageviews: 10, uniqueVisitors: 6 }],
      },
    });
    expect(result.rows.map((r) => [r.date, r.payingCustomers, r.visits])).toEqual([
      ['2026-03-28', 1, 0],
      ['2026-03-29', 1, 0],
      ['2026-03-30', 1, 7],
    ]);
  });
  it('fills partial endpoints across the autumn 25-hour day', () => {
    const autumn = { ...range, start: '2026-10-24T22:30:00Z', end: '2026-10-26T00:30:00Z' };
    expect(buildOverviewSeries({ ...input, range: autumn }).rows.map((r) => r.date)).toEqual([
      '2026-10-25',
      '2026-10-26',
    ]);
  });
  it('aggregates daily visits and deduplicates customers across a weekly bucket', () => {
    const result = buildOverviewSeries({
      ...input,
      range: { ...range, granularity: 'week' },
      payments: [pay('a'), pay('a', '2026-03-29T12:00:00Z'), pay('b')],
      posthog: {
        ...input.posthog,
        series: ['2026-03-28', '2026-03-29'].map((date) => ({
          date,
          visits: 9,
          pageviews: 20,
          uniqueVisitors: 8,
        })),
      },
    });
    expect(result.heading).toBe('overviewPerWeek');
    expect(result.rows[0]).toMatchObject({
      date: '2026-03-23',
      visits: 18,
      payingCustomers: 2,
      revenue: 30,
    });
    expect(result.rows[1]).toMatchObject({ date: '2026-03-30', visits: 0, revenue: 0 });
  });
  it.each([
    ['30d', 'auto', 'day', 'overviewPerDay'],
    ['90d', 'auto', 'day', 'overviewPerDay'],
    ['90d', 'week', 'week', 'overviewPerWeek'],
    ['30d', 'month', 'month', 'overviewPerMonth'],
    ['12m', 'auto', 'month', 'overviewPerMonth'],
    ['12m', 'day', 'day', 'overviewPerDay'],
  ])('respects %s / %s and labels the actual bucket', (period, granularity, expected, heading) => {
    const selected = periodRange({ period, granularity }, new Date('2026-11-11T12:00:00Z'));
    expect(selected.granularity).toBe(expected);
    expect(buildOverviewSeries({ ...input, range: selected }).heading).toBe(heading);
  });
  it('defaults a custom 91-day range to weeks', () => {
    expect(
      periodRange(
        { period: 'custom', from: '2026-01-01', to: '2026-04-01' },
        new Date('2026-11-11T12:00:00Z'),
      ).granularity,
    ).toBe('week');
  });
});

it('buckets model completion by immutable completion day and retains it after later state changes', () => {
  const result = buildOverviewSeries({
    ...input,
    renders: [
      render({ status: 'failed', glbKey: null, completedAt: new Date('2026-03-29T12:00:00Z') }),
    ],
  });
  expect(result.rows[0]).toMatchObject({ sheets: 1, models: 0, uses: 1 });
  expect(result.rows[1]).toMatchObject({ sheets: 0, models: 1, uses: 1 });
});
it('does not bucket an undated legacy model or future completion as historical activity', () => {
  const result = buildOverviewSeries({
    ...input,
    renders: [render({ completedAt: null }), render({ completedAt: new Date('2027-01-01') })],
  });
  expect(result.rows.reduce((sum, row) => sum + row.models, 0)).toBe(0);
});

it('places preview activity on the first immutable preview completion rather than upload date', () => {
  const result = buildOverviewSeries({
    ...input,
    renders: [render({ completedAt: null, previewCompletedAt: new Date('2026-03-29T12:00:00Z') })],
  });
  expect(result.rows[0]).toMatchObject({ sheets: 0, models: 0, uses: 0 });
  expect(result.rows[1]).toMatchObject({ sheets: 1, models: 0, uses: 1 });
});
