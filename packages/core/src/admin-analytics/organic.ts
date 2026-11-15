import { channel, type DataTable, type Range, type Row } from './helpers';

type User = { id: string; createdAt: Date };
type Attribution = {
  id: string;
  landing_path?: string | null;
  referrer?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
};
type Render = {
  id: string;
  userId: string | null;
  createdAt: Date;
  completedAt: Date | null;
  sheetKey: string | null;
  status: string;
  glbKey: string | null;
};
type Payment = { id: string; userId: string | null; at: string; gross: number };

/** A single signup population; no traffic joins, old-payer revenue or inferred completion dates. */
export function organicLandingTable(
  users: User[],
  attribution: Attribution[],
  renders: Render[],
  payments: Payment[],
  range: Pick<Range, 'start' | 'end'>,
): DataTable {
  const start = Date.parse(range.start),
    end = Date.parse(range.end);
  const attrs = new Map(attribution.map((item) => [item.id, item]));
  const members = new Map(
    users
      .filter(
        (user) =>
          +user.createdAt >= start &&
          +user.createdAt < end &&
          channel(attrs.get(user.id) ?? {}) === 'organicSearch',
      )
      .map((user) => [
        user.id,
        {
          user,
          landing: attrs.get(user.id)?.landing_path || 'unknown',
          hasPreview: false,
          hasLegacy: false,
          successes: new Set<string>(),
          orders: new Set<string>(),
        },
      ]),
  );
  for (const render of renders) {
    const member = render.userId ? members.get(render.userId) : undefined;
    if (!member || +render.createdAt >= end) continue;
    // A claimed pre-signup sheet is observable now, but its completion time is not immutable.
    if (render.sheetKey) member.hasPreview = true;
    if (
      render.completedAt &&
      +render.completedAt >= +member.user.createdAt &&
      +render.completedAt >= +render.createdAt &&
      +render.completedAt < end
    )
      member.successes.add(render.id);
    else if (!render.completedAt && render.status === 'ready' && render.glbKey)
      member.hasLegacy = true;
  }
  for (const payment of payments) {
    const member = payment.userId ? members.get(payment.userId) : undefined;
    if (
      member &&
      payment.gross > 0 &&
      Date.parse(payment.at) >= +member.user.createdAt &&
      Date.parse(payment.at) < end
    )
      member.orders.add(payment.id);
  }
  const rows = new Map<string, Row>();
  for (const member of members.values()) {
    const row = rows.get(member.landing) ?? {
      name: member.landing,
      signups: 0,
      previewAccounts: 0,
      firstSuccess: 0,
      secondSuccess: 0,
      cohortPayers: 0,
      repeatPayers: 0,
      legacyAccounts: 0,
    };
    for (const [key, count] of Object.entries({
      signups: 1,
      previewAccounts: Number(member.hasPreview),
      firstSuccess: Number(member.successes.size >= 1),
      secondSuccess: Number(member.successes.size >= 2),
      cohortPayers: Number(member.orders.size >= 1),
      repeatPayers: Number(member.orders.size >= 2),
      legacyAccounts: Number(member.hasLegacy),
    }))
      row[key] = Number(row[key]) + count;
    rows.set(member.landing, row);
  }
  return {
    key: 'organicLandings',
    columns: [
      'name',
      'signups',
      'previewAccounts',
      'firstSuccess',
      'secondSuccess',
      'cohortPayers',
      'repeatPayers',
      'legacyAccounts',
    ],
    rows: [...rows.values()].sort((a, b) => Number(b.signups) - Number(a.signups)),
    source: 'mixed',
    quality: 'proxy',
    note: 'organicCohortDefinition',
  };
}
