import type { Snapshot } from './database';
import {
  bucket,
  isExcluded,
  localDate,
  midnight,
  modelCompletedAt,
  type Range,
  sheetCompletedAt,
} from './helpers';
import type { Payment } from './report';
import type { PosthogSummary } from './sources';

export type OverviewPoint = {
  date: string;
  visits: number | null;
  payingCustomers: number;
  uses: number;
  sheets: number;
  models: number;
  revenue: number;
  newSignups: number;
};
export type OverviewSeries = {
  rows: OverviewPoint[];
  currency: string;
  heading: 'overviewPerDay' | 'overviewPerWeek' | 'overviewPerMonth';
  visitsNote: 'visitsNotConfigured' | 'visitsIncomplete' | 'visitsError' | null;
  hasData: boolean;
};

/** Inputs use the report's selected revenue source and team scope; no I/O or env reads. */
export function buildOverviewSeries({
  users,
  renders,
  payments,
  posthog,
  range,
  currency,
  exclusions = [],
}: {
  users: Array<Pick<Snapshot['users'][number], 'id' | 'email' | 'createdAt'>>;
  renders: Array<
    Pick<
      Snapshot['renders'][number],
      | 'userId'
      | 'createdAt'
      | 'completedAt'
      | 'previewCompletedAt'
      | 'status'
      | 'sheetKey'
      | 'glbKey'
    >
  >;
  payments: Array<Pick<Payment, 'userId' | 'at' | 'gross' | 'currency'>>;
  posthog: Pick<PosthogSummary, 'health' | 'series'>;
  range: Range;
  currency: string;
  exclusions?: string[];
}): OverviewSeries {
  const visitsNote = !posthog.health.configured
    ? 'visitsNotConfigured'
    : posthog.health.error
      ? 'visitsError'
      : posthog.health.isTruncated
        ? 'visitsIncomplete'
        : null;
  const excluded = new Set(
    users.filter((u) => !range.includeTeam && isExcluded(u.email, exclusions)).map((u) => u.id),
  );
  const rows = new Map<string, OverviewPoint>();
  // Walk local calendar days, including partial endpoints and 23/25-hour DST days.
  let day = localDate(range.start, range.timezone);
  while (+midnight(day, range.timezone) < Date.parse(range.end)) {
    const date = bucket(midnight(day, range.timezone), range.granularity, range.timezone);
    if (!rows.has(date))
      rows.set(date, {
        date,
        visits: visitsNote ? null : 0,
        payingCustomers: 0,
        uses: 0,
        sheets: 0,
        models: 0,
        revenue: 0,
        newSignups: 0,
      });
    const next = new Date(`${day}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    day = next.toISOString().slice(0, 10);
  }
  const rowAt = (at: Date | string) => {
    const time = +new Date(at);
    return time >= Date.parse(range.start) && time < Date.parse(range.end)
      ? rows.get(bucket(at, range.granularity, range.timezone))
      : undefined;
  };
  const payers = new Map<string, Set<string>>();
  for (const p of payments) {
    if (p.userId && excluded.has(p.userId)) continue;
    const row = rowAt(p.at);
    if (!row) continue;
    if (p.currency === currency) row.revenue += p.gross;
    if (p.userId) {
      const ids = payers.get(row.date) ?? new Set<string>();
      ids.add(p.userId);
      payers.set(row.date, ids);
      row.payingCustomers = ids.size;
    }
  }
  for (const r of renders) {
    if (r.userId && excluded.has(r.userId)) continue;
    const preview = sheetCompletedAt(r);
    const sheetRow = preview ? rowAt(preview) : undefined;
    if (sheetRow) {
      sheetRow.sheets++;
      sheetRow.uses++;
    }
    const completed = modelCompletedAt(r);
    const modelRow = completed ? rowAt(completed) : undefined;
    if (modelRow) {
      modelRow.models++;
      modelRow.uses++;
    }
  }
  for (const u of users) {
    if (excluded.has(u.id)) continue;
    const row = rowAt(u.createdAt);
    if (row) row.newSignups++;
  }
  if (!visitsNote)
    for (const p of posthog.series) {
      // PostHog dates already represent ANALYTICS_TZ, not UTC midnight.
      if (
        p.date < localDate(range.start, range.timezone) ||
        p.date > localDate(new Date(Date.parse(range.end) - 1), range.timezone)
      )
        continue;
      const row = rows.get(
        bucket(midnight(p.date, range.timezone), range.granularity, range.timezone),
      );
      if (row) row.visits = (row.visits ?? 0) + p.visits;
    }
  const points = [...rows.values()];
  return {
    rows: points,
    currency,
    heading:
      range.granularity === 'day'
        ? 'overviewPerDay'
        : range.granularity === 'week'
          ? 'overviewPerWeek'
          : 'overviewPerMonth',
    visitsNote,
    hasData: points.some(
      (r) =>
        (r.visits ?? 0) > 0 ||
        r.payingCustomers > 0 ||
        r.uses > 0 ||
        r.revenue !== 0 ||
        r.newSignups > 0,
    ),
  };
}
