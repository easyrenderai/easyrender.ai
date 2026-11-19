import 'server-only';
import {
  attributionColumns,
  buildOverviewSeries,
  buildReport,
  channel,
  databaseFinance,
  exclusionsFromEnv,
  fetchPosthog,
  fetchStripe,
  loadDatabase,
  modelCompletedAt,
  type OverviewSeries,
  periodRange,
  type Range,
  type Section,
  type SourceHealth,
  sheetCompletedAt,
  type Traffic,
  type View,
} from '@easyrender/core/admin-analytics';
import { db } from '@easyrender/db';
import { unstable_cache } from 'next/cache';
import { requireAdmin } from './auth';
import { analyticsConfigKey } from './cache-key';
export const ANALYTICS_TAG = 'admin-analytics';
function configKey() {
  return analyticsConfigKey([
    process.env.ADMIN_EMAILS,
    process.env.ANALYTICS_EXCLUDE_EMAILS,
    process.env.ANALYTICS_TZ,
    process.env.POSTHOG_API_HOST,
    process.env.POSTHOG_PROJECT_ID,
    process.env.POSTHOG_PERSONAL_API_KEY,
    process.env.STRIPE_ANALYTICS_KEY,
    process.env.STRIPE_SECRET_KEY,
    process.env.DATABASE_URL,
  ]);
}
const columnsCached = unstable_cache(
  async (_key: string) => attributionColumns(),
  ['admin-columns'],
  { revalidate: 300, tags: [ANALYTICS_TAG] },
);
const earliestCached = unstable_cache(
  async (_key: string) =>
    (
      await db().user.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } })
    )?.createdAt.toISOString() ?? new Date().toISOString(),
  ['admin-earliest'],
  { revalidate: 300, tags: [ANALYTICS_TAG] },
);
const trafficCached = unstable_cache(
  async (range: Range, _key: string) => fetchPosthog(range, undefined, undefined, range.timezone),
  ['admin-posthog'],
  { revalidate: 600, tags: [ANALYTICS_TAG] },
);
const stripeCached = unstable_cache(
  async (range: Range, _key: string) =>
    fetchStripe({ start: '1970-01-01T00:00:00.000Z', end: range.end }),
  ['admin-stripe'],
  { revalidate: 600, tags: [ANALYTICS_TAG] },
);
export async function adminRange(params: Record<string, string | undefined>) {
  await requireAdmin();
  const earliest = await earliestCached(configKey()).catch(() => '2020-01-01T00:00:00.000Z');
  return periodRange(params, new Date(), earliest, process.env.ANALYTICS_TZ);
}
export async function trafficData(range: Range) {
  await requireAdmin();
  return trafficCached(range, configKey());
}
export type DashboardData = {
  view: View;
  overview?: OverviewSeries;
  health: Array<SourceHealth & { source: string }>;
  range: Range;
};
const reportCached = unstable_cache(
  async (section: Section, range: Range, _key: string): Promise<DashboardData> => {
    const [postgresResult, stripe, posthog, previousPosthog] = await Promise.all([
      columnsCached(_key)
        .then((columns) => loadDatabase(range.includeTeam, exclusionsFromEnv(), columns))
        .catch((error: unknown) => ({
          error:
            error instanceof Error && error.message === 'analyticsRowLimit'
              ? 'analyticsRowLimit'
              : 'postgresUnavailable',
        })),
      stripeCached(range, _key),
      trafficCached(range, _key),
      trafficCached({ ...range, start: range.previousStart, end: range.previousEnd }, _key),
    ]);
    const postgres = 'error' in postgresResult ? null : postgresResult;
    const postgresError = 'error' in postgresResult ? postgresResult.error : null;
    const health: Array<SourceHealth & { source: string }> = [
      {
        source: 'postgres',
        configured: Boolean(process.env.DATABASE_URL),
        fetchedAt: postgres?.fetchedAt ?? null,
        rowCount: postgres
          ? postgres.users.length +
            postgres.renders.length +
            postgres.purchases.length +
            postgres.ledger.length +
            postgres.keys.length +
            postgres.viewSets.length +
            postgres.upscales.length
          : 0,
        error: postgresError,
        missing: process.env.DATABASE_URL ? [] : ['DATABASE_URL'],
        isTruncated: postgresError === 'analyticsRowLimit',
      },
      { source: 'stripe', ...stripe.health },
      { source: 'posthog', ...posthog.health },
    ];
    if (!postgres)
      return {
        view: {
          metrics: [],
          charts: [],
          tables: [],
          notes: [postgresError ?? 'postgresUnavailable'],
        },
        health,
        range,
      };
    const s = postgres;
    let finance = databaseFinance(s);
    if (stripe.health.configured && !stripe.health.error && !stripe.health.isTruncated) {
      const byCustomer = new Map(
        s.users.filter((u) => u.stripeCustomerId).map((u) => [u.stripeCustomerId, u.id]),
      );
      const ids = new Set(s.users.map((u) => u.id));
      const resolve = (id: string | null, customer: string | null) =>
        id && ids.has(id) ? id : customer ? (byCustomer.get(customer) ?? null) : null;
      finance = {
        isStripe: true,
        payments: stripe.transactions.flatMap((p) => {
          const userId = resolve(p.userId, p.customerId);
          if (!range.includeTeam && !userId) return [];
          return [
            {
              ...p,
              userId,
              credits: null,
              country:
                p.country === 'unknown'
                  ? (s.attribution.find((a) => a.id === userId)?.geo_country ?? 'unknown')
                  : p.country,
            },
          ];
        }),
        refunds: stripe.refunds.flatMap((r) => {
          const userId = resolve(null, r.customerId);
          return !range.includeTeam && !userId ? [] : [{ ...r, userId }];
        }),
        subscriptions: (() => {
          const grouped = new Map<
            string,
            { plan: string; currency: string; subscribers: number; mrr: number }
          >();
          for (const subscription of stripe.subscriptionDetails) {
            if (!range.includeTeam && !resolve(subscription.userId, subscription.customerId))
              continue;
            const key = `${subscription.plan}|${subscription.currency}`;
            const row = grouped.get(key) ?? {
              plan: subscription.plan,
              currency: subscription.currency,
              subscribers: 0,
              mrr: 0,
            };
            row.subscribers++;
            row.mrr += subscription.mrr;
            grouped.set(key, row);
          }
          return [...grouped.values()];
        })(),
      };
    }
    const hasTraffic =
      posthog.health.configured && !posthog.health.error && !posthog.health.isTruncated;
    const hasPrevious =
      previousPosthog.health.configured &&
      !previousPosthog.health.error &&
      !previousPosthog.health.isTruncated;
    const total = (rows: typeof posthog.series, key: 'visits' | 'uniqueVisitors') =>
      rows.reduce((n, r) => n + r[key], 0);
    const dimensions: Traffic['dimensions'] = { ...posthog.dimensions };
    const channels = new Map<string, number>();
    for (const a of posthog.acquisition) {
      const key = channel({ utm_source: a.source, utm_medium: a.medium, referrer: a.referrer });
      channels.set(key, (channels.get(key) ?? 0) + a.visits);
    }
    dimensions.channel = [...channels].map(([value, visits]) => ({ value, visits }));
    const traffic: Traffic = {
      visits: hasTraffic ? total(posthog.series, 'visits') : null,
      uniqueVisitors: hasTraffic ? total(posthog.series, 'uniqueVisitors') : null,
      previousVisits: hasPrevious ? total(previousPosthog.series, 'visits') : null,
      previousUniqueVisitors: hasPrevious ? total(previousPosthog.series, 'uniqueVisitors') : null,
      dimensions: hasTraffic ? dimensions : {},
    };
    const view = buildReport(section, s, range, finance, traffic);
    if (!hasTraffic) view.notes.push('posthogUnavailable');
    if (stripe.health.error || stripe.health.isTruncated) view.notes.push('stripeUnavailable');
    if (finance.isStripe && !range.includeTeam) view.notes.push('stripeScope');
    if (section === 'health') {
      view.tables.push({
        key: 'attributionColumns',
        columns: ['table', 'available'],
        rows: [
          { table: 'user', available: s.columns.user ? 'yes' : 'no' },
          { table: 'Render', available: s.columns.Render ? 'yes' : 'no' },
        ],
        source: 'postgres',
        quality: 'measured',
      });
      const within = (d: Date | string) =>
        +new Date(d) >= Date.parse(range.start) && +new Date(d) < Date.parse(range.end);
      const counts: Record<string, number | null> = {
        signup: s.users.filter((u) => within(u.createdAt)).length,
        // Starts include regenerations; Render.createdAt is not an immutable event history.
        preview_start: null,
        preview_ready: s.renders.filter((r) => {
          const completed = sheetCompletedAt(r);
          return completed !== null && within(completed);
        }).length,
        render_ready: s.renders.filter((r) => {
          const completed = modelCompletedAt(r);
          return completed !== null && within(completed);
        }).length,
        purchase:
          s.purchases.filter((p) => p.status === 'paid' && within(p.paidAt ?? p.createdAt)).length +
          s.ledger.filter(
            (l) =>
              l.reason === 'subscription' && l.delta > 0 && !l.purchaseId && within(l.createdAt),
          ).length,
      };
      view.tables.push({
        key: 'reconciliation',
        columns: ['event', 'database', 'posthog', 'difference'],
        rows: Object.entries(counts).map(([event, database]) => {
          const ph = hasTraffic
            ? (posthog.events.find((r) => r.event === event)?.count ?? 0)
            : null;
          return {
            event,
            database,
            posthog: ph,
            difference: ph === null || database === null ? null : ph - database,
          };
        }),
        source: 'mixed',
        quality: 'proxy',
        note: 'reconciliationScope',
      });
      view.notes.push('healthNotes');
    }
    const overview =
      section === 'overview'
        ? buildOverviewSeries({
            users: s.users,
            renders: s.renders,
            payments: finance.payments,
            posthog,
            range,
            currency: view.metrics.find((m) => m.key === 'gross')?.currency ?? 'USD',
            exclusions: exclusionsFromEnv(),
          })
        : undefined;
    return { view, health, range, overview };
  },
  ['admin-report-v2'],
  { revalidate: 300, tags: [ANALYTICS_TAG] },
);
export async function dashboardData(section: Section, range: Range) {
  await requireAdmin();
  return reportCached(section, range, configKey());
}

// Independent source boundary: database cards stream while optional APIs are still fetching.
const databaseReportCached = unstable_cache(
  async (range: Range, key: string) => {
    const snapshot = await loadDatabase(
      range.includeTeam,
      exclusionsFromEnv(),
      await columnsCached(key),
    );
    const view = buildReport('overview', snapshot, range, databaseFinance(snapshot), {
      visits: null,
      previousVisits: null,
      uniqueVisitors: null,
      previousUniqueVisitors: null,
      dimensions: {},
    });
    view.metrics = view.metrics.filter((metric) => DATABASE_METRICS.includes(metric.key));
    view.tables = [];
    view.charts = [];
    view.notes = [];
    return view;
  },
  ['admin-database-cards'],
  { revalidate: 300, tags: [ANALYTICS_TAG] },
);
export const DATABASE_METRICS = [
  'signups',
  'activatedSheet',
  'activatedModel',
  'anonymous',
  'sold',
  'consumed',
  'free',
  'returned',
  'sheetActivation',
  'modelActivation',
  'providerCost',
];
export async function databaseCards(range: Range) {
  await requireAdmin();
  return databaseReportCached(range, configKey()).catch(() => ({
    metrics: [],
    tables: [],
    charts: [],
    notes: ['postgresUnavailable'],
  }));
}
