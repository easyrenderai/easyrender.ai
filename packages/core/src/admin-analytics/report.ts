import { isPlanId, PLAN_IDS, SUBSCRIPTION_PLANS } from '@easyrender/harness';
import { activationTables } from './activation';
import type { Snapshot } from './database';
import {
  bucket,
  channel,
  cohorts,
  type DataTable,
  funnel,
  kpiFormulas,
  type Metric,
  percentile,
  type Range,
  type Row,
  ratio,
  referrerHost,
  type Section,
  SIGNAL_MIN_SIGNUPS,
  type View,
} from './helpers';
import { organicLandingTable } from './organic';

export type Payment = {
  id: string;
  userId: string | null;
  at: string;
  product: string;
  currency: string;
  gross: number;
  refunds: number;
  fees: number | null;
  country: string;
  credits: number | null;
};
export type Refund = {
  id: string;
  at: string;
  currency: string;
  amount: number;
  product: string;
  userId: string | null;
};
export type Finance = {
  payments: Payment[];
  refunds: Refund[];
  isStripe: boolean;
  subscriptions: Array<{ plan: string; currency: string; subscribers: number; mrr: number }>;
};
export type Traffic = {
  visits: number | null;
  previousVisits: number | null;
  uniqueVisitors: number | null;
  previousUniqueVisitors: number | null;
  dimensions: Record<string, Array<{ value: string; visits: number }>>;
};
const sum = <T>(items: T[], get: (v: T) => number) => items.reduce((n, v) => n + get(v), 0);
const within = (date: Date | string, start: string, end: string) =>
  +new Date(date) >= Date.parse(start) && +new Date(date) < Date.parse(end);
const iso = (value: Date | string) => new Date(value).toISOString();
const countUsers = (rows: Array<{ userId: string | null }>) =>
  new Set(rows.flatMap((r) => (r.userId ? [r.userId] : []))).size;
const groups = <T>(rows: T[], key: (v: T) => string): Array<[string, T[]]> => {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k) ?? [];
    list.push(row);
    map.set(k, list);
  }
  return [...map];
};
const table = (
  key: string,
  columns: string[],
  rows: Row[],
  source = 'postgres',
  quality: DataTable['quality'] = 'measured',
  note?: string,
): DataTable => ({ key, columns, rows, source, quality, note });
function planForGrant(credits: number) {
  return PLAN_IDS.find((id) => SUBSCRIPTION_PLANS[id].monthlyCredits === credits);
}
export function databaseFinance(snapshot: Snapshot): Finance {
  const country = new Map(snapshot.attribution.map((a) => [a.id, a.geo_country ?? 'unknown']));
  const payments: Payment[] = snapshot.purchases
    .filter((p) => p.status === 'paid')
    .map((p) => ({
      id: p.id,
      userId: p.userId,
      at: iso(p.createdAt),
      product: p.packId,
      currency: p.currency.toUpperCase(),
      gross: p.amountCents / 100,
      refunds: 0,
      fees: null,
      country: country.get(p.userId) ?? 'unknown',
      credits: p.credits,
    }));
  for (const [i, l] of snapshot.ledger.entries()) {
    // #88 records invoices as purchases; infer only legacy grants without a purchase link.
    if (l.reason !== 'subscription' || l.delta <= 0 || l.purchaseId) continue;
    const plan = planForGrant(l.delta);
    if (plan)
      payments.push({
        id: `subscription-${i}`,
        userId: l.userId,
        at: iso(l.createdAt),
        product: plan,
        currency: 'USD',
        gross: SUBSCRIPTION_PLANS[plan].priceCents / 100,
        refunds: 0,
        fees: null,
        country: country.get(l.userId) ?? 'unknown',
        credits: l.delta,
      });
  }
  const subscriptions = PLAN_IDS.map((plan) => {
    const subscribers = snapshot.users.filter(
      (u) =>
        ['active', 'trialing', 'past_due'].includes(u.subscriptionStatus ?? '') &&
        (isPlanId(u.subscriptionPlan) ? u.subscriptionPlan : 'pro') === plan,
    ).length;
    return {
      plan,
      currency: 'USD',
      subscribers,
      mrr: (subscribers * SUBSCRIPTION_PLANS[plan].priceCents) / 100,
    };
  });
  return { payments, refunds: [], isStripe: false, subscriptions };
}
export function buildReport(
  section: Section,
  s: Snapshot,
  range: Range,
  finance: Finance,
  traffic: Traffic,
): View {
  const view: View = {
    metrics: [],
    tables: [],
    charts: [],
    notes: [
      'periodDefinitions',
      'mutableRenderTimes',
      'boundedSnapshot',
      ...(finance.isStripe ? [] : ['dbFallback']),
      'anonymousTeamCaveat',
    ],
  };
  const source = finance.isStripe ? 'stripe' : 'postgres';
  const quality = finance.isStripe ? 'measured' : 'proxy';
  const inPeriod = (d: Date | string) => within(d, range.start, range.end);
  const users = s.users.filter((u) => inPeriod(u.createdAt));
  const renders = s.renders.filter((r) => inPeriod(r.createdAt));
  const previousRenders = s.renders.filter((r) =>
    within(r.createdAt, range.previousStart, range.previousEnd),
  );
  const payments = finance.payments.filter((p) => inPeriod(p.at));
  const refunds = finance.refunds.filter((r) => inPeriod(r.at));
  const userIds = new Set(s.users.map((u) => u.id));
  const attributed = new Map(s.attribution.filter((a) => userIds.has(a.id)).map((a) => [a.id, a]));
  const currencySet = new Set([
    ...finance.payments
      .filter((p) => within(p.at, range.previousStart, range.end))
      .map((p) => p.currency),
    ...finance.refunds
      .filter((p) => within(p.at, range.previousStart, range.end))
      .map((p) => p.currency),
    ...finance.subscriptions.map((p) => p.currency),
  ]);
  if (!currencySet.size) currencySet.add('USD');
  const currencies = [...currencySet];
  const isMulti = currencies.length > 1;
  const firstSheet = new Map<string, string>(),
    firstModel = new Map<string, string>(),
    firstPurchase = new Map<string, string>();
  const updateFirst = (map: Map<string, string>, id: string, date: Date | string) => {
    const v = iso(date);
    if (!map.has(id) || (map.get(id) ?? '') > v) map.set(id, v);
  };
  for (const r of s.renders) {
    if (!r.userId) continue;
    if (r.sheetKey) updateFirst(firstSheet, r.userId, r.createdAt);
    if (r.status === 'ready' && r.glbKey) updateFirst(firstModel, r.userId, r.updatedAt);
  }
  for (const p of finance.payments) if (p.userId) updateFirst(firstPurchase, p.userId, p.at);
  const acquired = (map: Map<string, string>, start: string, end: string) =>
    s.users.filter(
      (u) =>
        within(u.createdAt, start, end) &&
        map.has(u.id) &&
        Date.parse(map.get(u.id) as string) < Date.parse(end),
    ).length;
  const activity = (start: string, end: string) => {
    const rr = s.renders.filter((r) => within(r.createdAt, start, end));
    const pp = finance.payments.filter((p) => within(p.at, start, end));
    const ll = s.ledger.filter((l) => within(l.createdAt, start, end));
    const uu = s.users.filter((u) => within(u.createdAt, start, end));
    return {
      signups: uu.length,
      sheets: rr.filter((r) => r.sheetKey).length,
      models: rr.filter((r) => r.status === 'ready' && r.glbKey).length,
      anonymous: rr.filter((r) => !r.userId && r.anonId).length,
      paying: countUsers(pp),
      newPaying: [...firstPurchase.values()].filter((d) => within(d, start, end)).length,
      activatedSheet: acquired(firstSheet, start, end),
      activatedModel: acquired(firstModel, start, end),
      active: countUsers(rr),
      cost: sum(rr, (r) => r.costUsd),
      sold: sum(
        ll.filter((l) => ['purchase', 'subscription'].includes(l.reason) && l.delta > 0),
        (l) => l.delta,
      ),
      consumed: -sum(
        ll.filter((l) => l.delta < 0),
        (l) => l.delta,
      ),
      free: sum(
        ll.filter(
          (l) => l.delta > 0 && !['purchase', 'subscription', 'render_failed'].includes(l.reason),
        ),
        (l) => l.delta,
      ),
      returned: sum(
        ll.filter((l) => l.reason === 'render_failed'),
        (l) => l.delta,
      ),
      failure: ratio(
        rr.filter((r) => r.status === 'failed').length,
        rr.filter(
          (r) => r.status === 'failed' || r.status === 'ready' || r.status === 'preview_ready',
        ).length,
      ),
    };
  };
  const a = activity(range.start, range.end),
    b = activity(range.previousStart, range.previousEnd);
  function metric(
    key: string,
    value: number | null,
    previous: number | null,
    format: Metric['format'] = 'number',
    src = 'postgres',
    q: Metric['quality'] = 'measured',
    currency?: string,
    lowerIsBetter = false,
  ) {
    view.metrics.push({
      key,
      value,
      previous,
      format,
      source: src,
      quality: value === null ? 'unavailable' : q,
      currency,
      lowerIsBetter,
    });
  }
  const acquisitions = (start: string, end: string) =>
    s.users.filter((u) => within(u.createdAt, start, end));
  const funnelRows = funnel([
    { step: 'visits', count: traffic.visits },
    { step: 'signups', count: users.length },
    { step: 'activatedSheet', count: a.activatedSheet },
    { step: 'activatedModel', count: a.activatedModel },
    {
      step: 'paying',
      count: users.filter(
        (u) =>
          firstPurchase.has(u.id) &&
          Date.parse(firstPurchase.get(u.id) as string) < Date.parse(range.end),
      ).length,
    },
  ]);
  const series = groups(
    [
      ...s.users
        .filter((u) => inPeriod(u.createdAt))
        .map((u) => ({
          date: bucket(u.createdAt, range.granularity, range.timezone),
          signups: 1,
          revenue: 0,
        })),
      ...payments
        .filter((p) => p.currency === currencies[0])
        .map((p) => ({
          date: bucket(p.at, range.granularity, range.timezone),
          signups: 0,
          revenue: p.gross,
        })),
    ],
    (r) => r.date,
  )
    .map(([date, rows]) => ({
      date,
      signups: sum(rows, (r) => r.signups),
      revenue: sum(rows, (r) => r.revenue),
      previousRevenue: 0,
      previousSignups: 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const bucketKeys = new Set(series.map((row) => row.date));
  for (let time = Date.parse(range.start); time < Date.parse(range.end); time += 12 * 3600000) {
    const date = bucket(new Date(time), range.granularity, range.timezone);
    if (!bucketKeys.has(date)) {
      series.push({ date, signups: 0, revenue: 0, previousRevenue: 0, previousSignups: 0 });
      bucketKeys.add(date);
    }
  }
  const lastBucket = bucket(new Date(Date.parse(range.end) - 1), range.granularity, range.timezone);
  if (!bucketKeys.has(lastBucket))
    series.push({
      date: lastBucket,
      signups: 0,
      revenue: 0,
      previousRevenue: 0,
      previousSignups: 0,
    });
  series.sort((a, b) => a.date.localeCompare(b.date));
  const offset = Date.parse(range.end) - Date.parse(range.start);
  for (const row of series) {
    row.previousRevenue = sum(
      finance.payments.filter(
        (p) =>
          p.currency === currencies[0] &&
          within(p.at, range.previousStart, range.previousEnd) &&
          bucket(new Date(Date.parse(p.at) + offset), range.granularity, range.timezone) ===
            row.date,
      ),
      (p) => p.gross,
    );
    row.previousSignups = acquisitions(range.previousStart, range.previousEnd).filter(
      (u) =>
        bucket(new Date(+new Date(u.createdAt) + offset), range.granularity, range.timezone) ===
        row.date,
    ).length;
  }
  const productKeys = new Set([
    ...payments.map((p) => `${p.product}|${p.currency}`),
    ...refunds.map((r) => `${r.product}|${r.currency}`),
  ]);
  const productRows = [...productKeys].map((key) => {
    const [product, currency] = key.split('|');
    const pp = payments.filter((p) => p.product === product && p.currency === currency);
    const refund = sum(
      refunds.filter((r) => r.product === product && r.currency === currency),
      (r) => r.amount,
    );
    const gross = sum(pp, (p) => p.gross);
    return {
      product,
      currency,
      orders: pp.length,
      units: pp.some((r) => r.credits === null) ? null : sum(pp, (r) => r.credits ?? 0),
      gross,
      refunds: finance.isStripe ? refund : null,
      net: gross - refund,
      average: ratio(gross, pp.length),
    };
  });
  const planRows = finance.subscriptions.map((p) => ({ ...p }));
  const catalog = groups(
    s.renders.filter((r) => r.userId && r.status === 'ready' && r.glbKey),
    (r) => r.userId as string,
  ).map(([, rr]) => rr.length);
  const histogram = ['1', '2-5', '6-20', '21-100', '100+'].map((size, i) => ({
    size,
    accounts: catalog.filter((n) => n >= [1, 2, 6, 21, 101][i] && n <= [1, 5, 20, 100, Infinity][i])
      .length,
  }));
  if (section === 'overview' || section === 'revenue') {
    if (section === 'overview') {
      metric('visits', traffic.visits, traffic.previousVisits, 'number', 'posthog', 'proxy');
      metric(
        'uniqueVisitors',
        traffic.uniqueVisitors,
        traffic.previousUniqueVisitors,
        'number',
        'posthog',
        'proxy',
      );
      for (const key of [
        'signups',
        'activatedSheet',
        'activatedModel',
        'anonymous',
        'paying',
        'newPaying',
        'sold',
        'consumed',
        'free',
        'returned',
      ] as const)
        metric(
          key,
          a[key],
          b[key],
          'number',
          ['paying', 'newPaying'].includes(key) ? source : 'postgres',
          ['activatedSheet', 'activatedModel'].includes(key) ? 'proxy' : 'measured',
          undefined,
          key === 'returned',
        );
      metric(
        'sheetActivation',
        ratio(a.activatedSheet, a.signups),
        ratio(b.activatedSheet, b.signups),
        'percent',
        'postgres',
        'proxy',
      );
      metric(
        'modelActivation',
        ratio(a.activatedModel, a.signups),
        ratio(b.activatedModel, b.signups),
        'percent',
        'postgres',
        'proxy',
      );
      metric(
        'totalPayers',
        [...firstPurchase.values()].filter((d) => Date.parse(d) < Date.parse(range.end)).length,
        [...firstPurchase.values()].filter((d) => Date.parse(d) < Date.parse(range.start)).length,
      );
      metric('providerCost', a.cost, b.cost, 'currency', 'postgres', 'measured', 'USD', true);
    }
    for (const currency of currencies) {
      const current = payments.filter((p) => p.currency === currency),
        prev = finance.payments.filter(
          (p) => p.currency === currency && within(p.at, range.previousStart, range.previousEnd),
        );
      const gross = sum(current, (p) => p.gross),
        previousGross = sum(prev, (p) => p.gross),
        refunded = sum(
          refunds.filter((r) => r.currency === currency),
          (r) => r.amount,
        ),
        previousRefund = sum(
          finance.refunds.filter(
            (r) => r.currency === currency && within(r.at, range.previousStart, range.previousEnd),
          ),
          (r) => r.amount,
        );
      const currentKpi = kpiFormulas(gross, refunded, a.active, countUsers(current), a.cost),
        previousKpi = kpiFormulas(
          previousGross,
          previousRefund,
          b.active,
          countUsers(prev),
          b.cost,
        );
      metric('gross', gross, previousGross, 'currency', source, quality, currency);
      metric(
        'refunds',
        finance.isStripe ? refunded : null,
        finance.isStripe ? previousRefund : null,
        'currency',
        source,
        finance.isStripe ? 'measured' : 'unavailable',
        currency,
        true,
      );
      metric('net', currentKpi.net, previousKpi.net, 'currency', source, quality, currency);
      metric(
        'fees',
        finance.isStripe && current.every((p) => p.fees !== null)
          ? sum(current, (p) => p.fees ?? 0)
          : null,
        finance.isStripe && prev.every((p) => p.fees !== null)
          ? sum(prev, (p) => p.fees ?? 0)
          : null,
        'currency',
        source,
        finance.isStripe ? 'measured' : 'unavailable',
        currency,
        true,
      );
      metric('arpu', currentKpi.arpu, previousKpi.arpu, 'currency', source, 'proxy', currency);
      metric('arppu', currentKpi.arppu, previousKpi.arppu, 'currency', source, quality, currency);
      metric(
        'mrr',
        sum(
          planRows.filter((p) => p.currency === currency),
          (p) => p.mrr,
        ),
        null,
        'currency',
        source,
        quality,
        currency,
      );
      if (currency === 'USD')
        metric('margin', currentKpi.margin, previousKpi.margin, 'percent', source, 'proxy');
    }
    metric(
      'subscribers',
      sum(planRows, (p) => p.subscribers),
      null,
      'number',
      source,
      quality,
    );
    view.tables.push(
      table('plans', ['plan', 'currency', 'subscribers', 'mrr'], planRows, source, quality),
      table(
        'products',
        ['product', 'currency', 'orders', 'units', 'gross', 'refunds', 'net', 'average'],
        productRows,
        source,
        quality,
      ),
    );
    if (section === 'overview') {
      view.charts.push(
        {
          key: 'incomeUsage',
          kind: 'area',
          rows: series,
          series: ['revenue', 'signups', 'previousRevenue', 'previousSignups'],
          currency: currencies[0],
        },
        { key: 'funnel', kind: 'bar', rows: funnelRows, series: ['count'] },
        {
          key: 'incomeDistribution',
          kind: 'donut',
          rows: productRows
            .filter((r) => r.currency === currencies[0])
            .map((r) => ({ name: r.product, value: r.gross })),
          series: ['value'],
          currency: currencies[0],
        },
      );
      view.tables.push(
        table('funnel', ['step', 'count', 'conversion', 'dropoff'], funnelRows, 'mixed', 'proxy'),
      );
    } else {
      const revenueTime = groups(
        payments,
        (p) => `${bucket(p.at, range.granularity, range.timezone)}|${p.product}|${p.currency}`,
      ).map(([, pp]) => ({
        date: bucket(pp[0].at, range.granularity, range.timezone),
        product: pp[0].product,
        currency: pp[0].currency,
        orders: pp.length,
        gross: sum(pp, (p) => p.gross),
      }));
      view.tables.push(
        table(
          'revenueTime',
          ['date', 'product', 'currency', 'orders', 'gross'],
          revenueTime,
          source,
          quality,
        ),
      );
      const chartRows = groups(
        revenueTime.filter((r) => r.currency === currencies[0]),
        (r) => r.date,
      )
        .map(([date, rr]) => ({
          date,
          ...Object.fromEntries(
            ['payg', ...PLAN_IDS].map((p) => [
              p,
              sum(
                rr.filter((r) => r.product === p),
                (r) => r.gross,
              ),
            ]),
          ),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
      view.charts.push({
        key: 'revenueTime',
        kind: 'bar',
        rows: chartRows,
        series: ['payg', ...PLAN_IDS],
        currency: currencies[0],
      });
      view.tables.push(
        table(
          'countries',
          ['country', 'currency', 'gross', 'orders'],
          groups(payments, (p) => `${p.country}|${p.currency}`).map(([, pp]) => ({
            country: pp[0].country,
            currency: pp[0].currency,
            gross: sum(pp, (p) => p.gross),
            orders: pp.length,
          })),
          source,
          quality,
        ),
      );
      view.tables.push(
        table(
          'customerType',
          ['type', 'currency', 'orders', 'gross'],
          groups(
            payments,
            (p) =>
              `${p.userId && inPeriod(firstPurchase.get(p.userId) ?? '1900-01-01') ? 'new' : 'returning'}|${p.currency}`,
          ).map(([key, pp]) => ({
            type: key.split('|')[0],
            currency: pp[0].currency,
            orders: pp.length,
            gross: sum(pp, (p) => p.gross),
          })),
          source,
          'proxy',
        ),
      );
      view.tables.push(
        table(
          'refundList',
          ['id', 'at', 'currency', 'amount', 'product'],
          refunds.map((r) => ({ ...r })),
          source,
          finance.isStripe ? 'measured' : 'unavailable',
        ),
      );
      view.tables.push(
        table(
          'ltv',
          ['email', 'currency', 'gross', 'orders'],
          groups(
            finance.payments.filter((p) => Date.parse(p.at) < Date.parse(range.end)),
            (p) => `${p.userId}|${p.currency}`,
          )
            .map(([, pp]) => ({
              email: s.users.find((u) => u.id === pp[0].userId)?.email ?? 'unknown',
              currency: pp[0].currency,
              gross: sum(pp, (p) => p.gross),
              orders: pp.length,
            }))
            .sort((a, b) => b.gross - a.gross)
            .slice(0, 100),
          source,
          quality,
        ),
      );
    }
    if (isMulti) view.notes.push('multipleCurrencies');
  }
  if (section === 'attribution') {
    if (!s.columns.user || !s.columns.Render) {
      view.notes.push('attributionMissing');
      return view;
    }
    view.tables.push(
      organicLandingTable(s.users, s.attribution, s.renders, finance.payments, range),
    );
    const dimensions = [
      'channel',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'referrer',
      'landing_path',
      'geo_country',
    ] as const;
    const dimensionMap: Record<string, string> = {
      utm_source: 'source',
      utm_medium: 'medium',
      utm_campaign: 'campaign',
      utm_content: 'content',
      referrer: 'referrer',
      landing_path: 'landing',
      geo_country: 'country',
    };
    for (const dimension of dimensions) {
      const value = (id: string) => {
        const attr = attributed.get(id);
        return dimension === 'channel'
          ? attr
            ? channel(attr)
            : 'unknown'
          : dimension === 'referrer'
            ? referrerHost(attr?.referrer) || 'unknown'
            : attr?.[dimension] || 'unknown';
      };
      // Revenue is activity in this period, attributed to every payer's first touch, not just new signups.
      const keys = new Set([
        ...users.map((u) => value(u.id)),
        ...(
          traffic.dimensions[dimension === 'channel' ? 'channel' : dimensionMap[dimension]] ?? []
        ).map((row) => row.value || 'unknown'),
        ...payments.flatMap((p) => (p.userId ? [value(p.userId)] : [])),
      ]);
      const rows: Row[] = [];
      for (const name of keys)
        for (const currency of currencies) {
          const uu = users.filter((u) => value(u.id) === name),
            pp = payments.filter(
              (p) => p.userId && value(p.userId) === name && p.currency === currency,
            );
          const payerIds = new Set(pp.flatMap((p) => (p.userId ? [p.userId] : [])));
          const signupPayers = uu.filter((u) => payerIds.has(u.id)).length;
          const visits =
            dimension === 'channel'
              ? (traffic.dimensions.channel?.find((r) => (r.value || 'unknown') === name)?.visits ??
                null)
              : (traffic.dimensions[dimensionMap[dimension]]?.find(
                  (r) => (r.value || 'unknown') === name,
                )?.visits ?? null);
          const revenue = sum(pp, (p) => p.gross);
          const conversion = ratio(signupPayers, uu.length);
          const avg =
            ratio(
              users.filter(
                (u) => firstPurchase.has(u.id) && inPeriod(firstPurchase.get(u.id) as string),
              ).length,
              users.length,
            ) ?? 0;
          rows.push({
            name,
            currency,
            visits,
            signups: uu.length,
            activatedSheet: uu.filter(
              (u) =>
                firstSheet.has(u.id) &&
                Date.parse(firstSheet.get(u.id) as string) < Date.parse(range.end),
            ).length,
            activatedModel: uu.filter(
              (u) =>
                firstModel.has(u.id) &&
                Date.parse(firstModel.get(u.id) as string) < Date.parse(range.end),
            ).length,
            paying: payerIds.size,
            revenue,
            visitSignup: visits === null ? null : ratio(uu.length, visits),
            signupPayer: conversion,
            revenueSignup: ratio(revenue, uu.length),
            signal:
              uu.length >= SIGNAL_MIN_SIGNUPS && signupPayers === 0
                ? 'noPayers'
                : uu.length >= SIGNAL_MIN_SIGNUPS && (conversion ?? 0) > avg
                  ? 'aboveAverage'
                  : 'insufficient',
          });
        }
      rows.sort((a, b) => Number(b.revenue) - Number(a.revenue));
      view.tables.push(
        table(
          dimension,
          [
            'name',
            'currency',
            'visits',
            'signups',
            'activatedSheet',
            'activatedModel',
            'paying',
            'revenue',
            'visitSignup',
            'signupPayer',
            'revenueSignup',
            'signal',
          ],
          rows,
          'mixed',
          'proxy',
          'attributionScope',
        ),
      );
      if (dimension === 'channel') {
        view.charts.push(
          {
            key: 'channels',
            kind: 'bar',
            rows: rows.filter((r) => r.currency === currencies[0]),
            series: ['signups', 'paying'],
          },
          {
            key: 'channelRevenue',
            kind: 'donut',
            rows: rows
              .filter((r) => r.currency === currencies[0])
              .map((r) => ({ name: r.name, value: r.revenue })),
            series: ['value'],
            currency: currencies[0],
          },
        );
      }
    }
    metric(
      'utmCoverage',
      ratio(
        users.filter((u) => attributed.get(u.id)?.utm_source && attributed.get(u.id)?.utm_campaign)
          .length,
        users.length,
      ),
      ratio(
        acquisitions(range.previousStart, range.previousEnd).filter(
          (u) => attributed.get(u.id)?.utm_source && attributed.get(u.id)?.utm_campaign,
        ).length,
        acquisitions(range.previousStart, range.previousEnd).length,
      ),
      'percent',
    );
    view.tables.push(
      table(
        'previewCountries',
        ['country', 'previews'],
        groups(
          renders,
          (r) => s.renderAttribution.find((a) => a.id === r.id)?.geo_country ?? 'unknown',
        ).map(([country, rr]) => ({ country, previews: rr.length })),
      ),
    );
    view.notes.push('weeklyReading', 'visitsCaveat');
  }
  if (section === 'funnel') {
    view.tables.push(
      table('funnel', ['step', 'count', 'conversion', 'dropoff'], funnelRows, 'mixed', 'proxy'),
    );
    view.charts.push({ key: 'funnel', kind: 'bar', rows: funnelRows, series: ['count'] });
    for (const [key, map] of [
      ['timeSheet', firstSheet],
      ['timeModel', firstModel],
      ['timePurchase', firstPurchase],
    ] as const) {
      const times = (us: typeof users, end: string) =>
        us.flatMap((u) => {
          const date = map.get(u.id);
          return date && Date.parse(date) < Date.parse(end)
            ? [(Date.parse(date) - +new Date(u.createdAt)) / 60000]
            : [];
        });
      metric(
        key,
        percentile(times(users, range.end), 0.5),
        percentile(
          times(acquisitions(range.previousStart, range.previousEnd), range.previousEnd),
          0.5,
        ),
        'minutes',
        'postgres',
        'proxy',
      );
    }
    const members = users.map((u) => ({
      signup: iso(u.createdAt),
      sheet: firstSheet.get(u.id) ?? null,
      model: firstModel.get(u.id) ?? null,
      purchase: firstPurchase.get(u.id) ?? null,
      revenue: sum(
        finance.payments.filter(
          (p) =>
            p.userId === u.id &&
            p.currency === currencies[0] &&
            Date.parse(p.at) < Date.parse(range.end),
        ),
        (p) => p.gross,
      ),
    }));
    view.tables.push(
      table(
        'cohorts',
        [
          'week',
          'step',
          'users',
          ...Array.from({ length: 9 }, (_, i) => `w${i}`),
          'revenue',
          'currency',
        ],
        cohorts(members, range.end, range.timezone).map((row) => ({
          ...row,
          currency: currencies[0],
        })),
        'mixed',
        'proxy',
        'cohortDefinition',
      ),
    );
    metric(
      'claimedPreviews',
      renders.filter((r) => r.anonId && r.userId).length,
      previousRenders.filter((r) => r.anonId && r.userId).length,
      'number',
      'postgres',
      'proxy',
    );
    view.notes.push('anonymousLink');
  }
  if (section === 'product' || section === 'icp') {
    view.tables.push(table('catalog', ['size', 'accounts'], histogram));
    view.tables.push(
      table(
        'sources',
        ['source', 'renders', 'models', 'providerCost'],
        groups(renders, (r) => r.source).map(([source, rr]) => ({
          source,
          renders: rr.length,
          models: rr.filter((r) => r.status === 'ready' && r.glbKey).length,
          providerCost: sum(rr, (r) => r.costUsd),
        })),
      ),
    );
    if (section === 'product') {
      view.tables.push(...activationTables(s.renders, range));
      metric('sheets', a.sheets, b.sheets);
      metric('models', a.models, b.models);
      metric('failure', a.failure, b.failure, 'percent', 'postgres', 'measured', undefined, true);
      metric(
        'success',
        a.failure === null ? null : 1 - a.failure,
        b.failure === null ? null : 1 - b.failure,
        'percent',
      );
      const terminal = renders.filter((r) =>
        ['ready', 'failed', 'preview_ready'].includes(r.status),
      );
      const previousDurations = previousRenders
        .filter((r) => ['ready', 'failed', 'preview_ready'].includes(r.status))
        .map((r) => (+new Date(r.updatedAt) - +new Date(r.createdAt)) / 60000);
      const durations = terminal.map(
        (r) => (+new Date(r.updatedAt) - +new Date(r.createdAt)) / 60000,
      );
      metric(
        'generationMedian',
        percentile(durations, 0.5),
        percentile(previousDurations, 0.5),
        'minutes',
        'postgres',
        'proxy',
        undefined,
        true,
      );
      metric(
        'generationP90',
        percentile(durations, 0.9),
        percentile(previousDurations, 0.9),
        'minutes',
        'postgres',
        'proxy',
        undefined,
        true,
      );
      metric(
        'costModel',
        ratio(a.cost, a.models),
        ratio(b.cost, b.models),
        'currency',
        'postgres',
        'proxy',
        'USD',
        true,
      );
      metric(
        'publicShare',
        ratio(
          renders.filter((r) => r.isPublic && r.status === 'ready' && r.glbKey).length,
          a.models,
        ),
        ratio(
          previousRenders.filter((r) => r.isPublic && r.status === 'ready' && r.glbKey).length,
          b.models,
        ),
        'percent',
      );
      metric(
        'keysCreated',
        s.keys.filter((k) => inPeriod(k.createdAt)).length,
        s.keys.filter((k) => within(k.createdAt, range.previousStart, range.previousEnd)).length,
      );
      metric(
        'keysUsed',
        s.keys.filter((k) => k.lastUsedAt && inPeriod(k.lastUsedAt)).length,
        s.keys.filter(
          (k) => k.lastUsedAt && within(k.lastUsedAt, range.previousStart, range.previousEnd),
        ).length,
        'number',
        'postgres',
        'proxy',
      );
      metric(
        'timeModel',
        percentile(
          users.flatMap((u) =>
            firstModel.has(u.id) &&
            Date.parse(firstModel.get(u.id) as string) < Date.parse(range.end)
              ? [(Date.parse(firstModel.get(u.id) as string) - +new Date(u.createdAt)) / 60000]
              : [],
          ),
          0.5,
        ),
        percentile(
          acquisitions(range.previousStart, range.previousEnd).flatMap((u) =>
            firstModel.has(u.id) &&
            Date.parse(firstModel.get(u.id) as string) < Date.parse(range.previousEnd)
              ? [(Date.parse(firstModel.get(u.id) as string) - +new Date(u.createdAt)) / 60000]
              : [],
          ),
          0.5,
        ),
        'minutes',
        'postgres',
        'proxy',
      );
      const statusRows = groups(renders, (r) =>
        bucket(r.createdAt, range.granularity, range.timezone),
      )
        .map(([date, rr]) => ({
          date,
          ready: rr.filter((r) => r.status === 'ready' || r.status === 'preview_ready').length,
          failed: rr.filter((r) => r.status === 'failed').length,
          inProgress: rr.filter((r) => r.status === 'rendering' || r.status === 'drafting').length,
          sheets: rr.filter((r) => r.sheetKey).length,
          models: rr.filter((r) => r.status === 'ready' && r.glbKey).length,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
      view.charts.push(
        {
          key: 'generation',
          kind: 'bar',
          rows: statusRows,
          series: ['ready', 'failed', 'inProgress'],
        },
        {
          key: 'sources',
          kind: 'bar',
          rows: view.tables.find((t) => t.key === 'sources')?.rows ?? [],
          series: ['renders', 'models'],
        },
      );
      view.tables.push(
        table(
          'generation',
          ['date', 'ready', 'failed', 'inProgress', 'sheets', 'models'],
          statusRows,
        ),
      );
      // Do not return free-text upstream errors; classify into safe, fixed categories.
      const failureCategory = (error: string | null) =>
        /timeout|stale|never started/i.test(error ?? '')
          ? 'timeout'
          : /guard|invalid|empty|photo|sheet|glb/i.test(error ?? '')
            ? 'validation'
            : /429|rate|quota/i.test(error ?? '')
              ? 'capacity'
              : 'provider';
      view.tables.push(
        table(
          'failures',
          ['reason', 'count'],
          groups(
            renders.filter((r) => r.status === 'failed'),
            (r) => failureCategory(r.error),
          ).map(([reason, rr]) => ({ reason, count: rr.length })),
        ),
      );
      view.tables.push(
        table(
          'accounts',
          ['email', 'renders', 'models', 'consumed', 'revenue', 'currency', 'lastActive'],
          groups(
            renders.filter((r) => r.userId),
            (r) => r.userId as string,
          )
            .map(([id, rr]) => ({
              email: s.users.find((u) => u.id === id)?.email ?? 'unknown',
              renders: rr.length,
              models: rr.filter((r) => r.status === 'ready' && r.glbKey).length,
              consumed: -sum(
                s.ledger.filter((l) => l.userId === id && l.delta < 0 && inPeriod(l.createdAt)),
                (l) => l.delta,
              ),
              revenue: sum(
                payments.filter((p) => p.userId === id && p.currency === currencies[0]),
                (p) => p.gross,
              ),
              currency: currencies[0],
              lastActive:
                rr
                  .map((r) => iso(r.updatedAt))
                  .sort()
                  .at(-1) ?? null,
            }))
            .sort((a, b) => b.renders - a.renders)
            .slice(0, 100),
        ),
      );
    } else {
      view.notes.push('profilePlanned');
      const freeDomains = [
        'gmail.com',
        'googlemail.com',
        'yahoo.com',
        'hotmail.com',
        'outlook.com',
        'live.com',
        'icloud.com',
        'proton.me',
        'protonmail.com',
        'aol.com',
        'msn.com',
      ];
      const domain = (email: string) => email.split('@')[1]?.toLowerCase() ?? 'unknown';
      view.tables.push(
        table(
          'emailType',
          ['type', 'users'],
          groups(users, (u) =>
            freeDomains.includes(domain(u.email)) ? 'freeMailbox' : 'company',
          ).map(([type, uu]) => ({ type, users: uu.length })),
          'postgres',
          'proxy',
        ),
      );
      view.tables.push(
        table(
          'companyDomains',
          ['domain', 'users'],
          groups(
            users.filter((u) => !freeDomains.includes(domain(u.email))),
            (u) => domain(u.email),
          )
            .map(([domain, uu]) => ({ domain, users: uu.length }))
            .sort((a, b) => b.users - a.users)
            .slice(0, 25),
          'postgres',
          'proxy',
        ),
      );
      view.tables.push(
        table(
          'countries',
          ['country', 'users'],
          groups(users, (u) => attributed.get(u.id)?.geo_country ?? 'unknown').map(
            ([country, uu]) => ({ country, users: uu.length }),
          ),
        ),
      );
      view.tables.push(
        table('plans', ['plan', 'currency', 'subscribers', 'mrr'], planRows, source, quality),
      );
    }
  }
  return view;
}
