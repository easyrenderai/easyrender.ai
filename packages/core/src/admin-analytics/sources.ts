import Stripe from 'stripe';
import { FUNNEL_EVENTS } from '../analytics-events';

export interface AnalyticsRange {
  start: string;
  end: string;
}

export interface SourceHealth {
  configured: boolean;
  fetchedAt: string | null;
  rowCount: number;
  error: string | null;
  missing: string[];
  isTruncated: boolean;
}

const MAX_ROWS = 1000;
const MAX_PAGES = 10;
const TIMEOUT_MS = 8000;
const DIMENSIONS = {
  source: 'properties.utm_source',
  medium: 'properties.utm_medium',
  campaign: 'properties.utm_campaign',
  content: 'properties.utm_content',
  referrer: "coalesce(nullIf(properties.referrer_host, ''), properties.$referring_domain)",
  landing: 'properties.$pathname',
  country: "coalesce(nullIf(properties.geo_country, ''), properties.$geoip_country_code)",
} as const;
export type PosthogDimension = keyof typeof DIMENSIONS;
export type HogqlKind = 'series' | 'events' | 'acquisition' | PosthogDimension;

function validateRange(range: AnalyticsRange) {
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
  for (const value of [range.start, range.end]) {
    if (!iso.test(value) || !Number.isFinite(Date.parse(value)))
      throw new Error('Invalid ISO range');
    if (
      new Date(value).toISOString() !== (value.includes('.') ? value : value.replace('Z', '.000Z'))
    )
      throw new Error('Invalid ISO calendar date');
  }
  if (Date.parse(range.start) >= Date.parse(range.end)) throw new Error('Invalid range order');
}

/** Only fixed expressions, validated UTC instants and validated IANA zone names enter HogQL. */
export function buildHogql(kind: HogqlKind, range: AnalyticsRange, timezone = 'Europe/Madrid') {
  validateRange(range);
  if (!/^[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)*$/.test(timezone))
    throw new Error('Invalid timezone');
  new Intl.DateTimeFormat('en', { timeZone: timezone });
  const utc = (value: string) => value.slice(0, 19).replace('T', ' ');
  const dates = `timestamp >= toDateTime('${utc(range.start)}', 'UTC') AND timestamp < toDateTime('${utc(range.end)}', 'UTC')`;
  const web = `FROM events WHERE ${dates} AND event IN ('$pageview', 'landing_view')`;
  const counts =
    "countIf(event = 'landing_view') AS visits, countIf(event = '$pageview') AS pageviews";
  if (kind === 'series') {
    // HogQL's toDate accepts one argument, unlike ClickHouse's optional timezone argument.
    // Convert the timestamp first so midnight/DST boundaries use the requested local day.
    return `SELECT toString(toDate(toTimeZone(timestamp, '${timezone}'))) AS date, ${counts}, uniqIf(distinct_id, event = '$pageview') AS uniqueVisitors ${web} GROUP BY date ORDER BY date LIMIT ${MAX_ROWS}`;
  }
  if (kind === 'events') {
    return `SELECT event, count() AS count FROM events WHERE ${dates} AND event IN (${FUNNEL_EVENTS.map((name) => `'${name}'`).join(', ')}) GROUP BY event ORDER BY event LIMIT ${MAX_ROWS}`;
  }
  if (kind === 'acquisition') {
    return `SELECT coalesce(toString(${DIMENSIONS.source}), '') AS source, coalesce(toString(${DIMENSIONS.medium}), '') AS medium, coalesce(toString(${DIMENSIONS.referrer}), '') AS referrer, ${counts} ${web} GROUP BY source, medium, referrer ORDER BY visits DESC LIMIT ${MAX_ROWS}`;
  }
  if (!Object.hasOwn(DIMENSIONS, kind)) throw new Error('Unknown analytics dimension');
  return `SELECT coalesce(toString(${DIMENSIONS[kind]}), '') AS value, ${counts} ${web} GROUP BY value ORDER BY visits DESC LIMIT ${MAX_ROWS}`;
}

export interface PosthogConfig {
  host: string;
  projectId: string;
  key: string;
}
export interface PosthogSummary {
  health: SourceHealth;
  series: { date: string; visits: number; pageviews: number; uniqueVisitors: number }[];
  dimensions: Record<PosthogDimension, { value: string; visits: number; pageviews: number }[]>;
  acquisition: {
    source: string;
    medium: string;
    referrer: string;
    visits: number;
    pageviews: number;
  }[];
  events: { event: string; count: number }[];
  scope: 'unfiltered';
  uniqueVisitorsQuality: 'daily-hash estimate';
}

function health(missing: string[]): SourceHealth {
  return {
    configured: missing.length === 0,
    fetchedAt: null,
    rowCount: 0,
    error: null,
    missing,
    isTruncated: false,
  };
}

const number = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0;
const string = (value: unknown) => (typeof value === 'string' ? value.slice(0, 500) : '');

/** Cookieless visits and server-event reconciliation include team activity; DB metrics can exclude it. */
export async function fetchPosthog(
  range: AnalyticsRange,
  config: PosthogConfig = {
    host: process.env.POSTHOG_API_HOST || 'https://eu.posthog.com',
    projectId: process.env.POSTHOG_PROJECT_ID || '',
    key: process.env.POSTHOG_PERSONAL_API_KEY || '',
  },
  fetcher: typeof fetch = fetch,
  timezone = 'Europe/Madrid',
): Promise<PosthogSummary> {
  const missing = [
    !config.projectId && 'POSTHOG_PROJECT_ID',
    !config.key && 'POSTHOG_PERSONAL_API_KEY',
  ].filter((v): v is string => Boolean(v));
  const result: PosthogSummary = {
    health: health(missing),
    series: [],
    events: [],
    acquisition: [],
    dimensions: {
      source: [],
      medium: [],
      campaign: [],
      content: [],
      referrer: [],
      landing: [],
      country: [],
    },
    scope: 'unfiltered',
    uniqueVisitorsQuality: 'daily-hash estimate',
  };
  if (missing.length) return result;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const url = new URL(config.host);
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      !/^\d+$/.test(config.projectId)
    )
      throw new Error('config');
    const kinds: HogqlKind[] = [
      'series',
      'events',
      'acquisition',
      ...(Object.keys(DIMENSIONS) as PosthogDimension[]),
    ];
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('timeout'));
      }, TIMEOUT_MS);
    });
    const responses = await Promise.race([
      Promise.all(
        kinds.map(async (kind) => {
          const response = await fetcher(`${url.origin}/api/projects/${config.projectId}/query/`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: { kind: 'HogQLQuery', query: buildHogql(kind, range, timezone) },
            }),
            signal: controller.signal,
          });
          if (!response.ok)
            throw new Error(
              response.status === 401 || response.status === 403 ? 'unauthorized' : 'upstream',
            );
          const payload: unknown = await response.json();
          if (
            !payload ||
            typeof payload !== 'object' ||
            !('results' in payload) ||
            !Array.isArray(payload.results)
          )
            throw new Error('shape');
          const rows = payload.results
            .slice(0, MAX_ROWS)
            .filter((row): row is unknown[] => Array.isArray(row));
          return { kind, rows, isTruncated: payload.results.length >= MAX_ROWS };
        }),
      ),
      timeout,
    ]);
    for (const { kind, rows, isTruncated } of responses) {
      result.health.rowCount += rows.length;
      result.health.isTruncated ||= isTruncated;
      if (kind === 'series')
        result.series = rows.map((row) => ({
          date: string(row[0]),
          visits: number(row[1]),
          pageviews: number(row[2]),
          uniqueVisitors: number(row[3]),
        }));
      else if (kind === 'events')
        result.events = rows
          .filter((row) => FUNNEL_EVENTS.some((event) => event === row[0]))
          .map((row) => ({ event: string(row[0]), count: number(row[1]) }));
      else if (kind === 'acquisition')
        result.acquisition = rows.map((row) => ({
          source: string(row[0]),
          medium: string(row[1]),
          referrer: string(row[2]),
          visits: number(row[3]),
          pageviews: number(row[4]),
        }));
      else
        result.dimensions[kind] = rows.map((row) => ({
          value: string(row[0]),
          visits: number(row[1]),
          pageviews: number(row[2]),
        }));
    }
  } catch (error) {
    controller.abort();
    const reason = error instanceof Error ? error.message : '';
    result.health.error =
      reason === 'timeout' || controller.signal.reason?.name === 'TimeoutError'
        ? 'PostHog request timed out.'
        : reason === 'unauthorized'
          ? 'PostHog authorization failed.'
          : 'PostHog unavailable; check configuration and query permissions.';
  } finally {
    clearTimeout(timer);
    result.health.fetchedAt = new Date().toISOString();
  }
  return result;
}

type Page<T> = { data: T[]; has_more: boolean };
export interface StripeAnalyticsClient {
  charges: { list(params: Stripe.ChargeListParams): Promise<Page<Stripe.Charge>> };
  refunds: { list(params: Stripe.RefundListParams): Promise<Page<Stripe.Refund>> };
  invoices: { list(params: Stripe.InvoiceListParams): Promise<Page<Stripe.Invoice>> };
  subscriptions: {
    list(params: Stripe.SubscriptionListParams): Promise<Page<Stripe.Subscription>>;
  };
}
export interface StripeTransaction {
  id: string;
  userId: string | null;
  customerId: string | null;
  at: string;
  currency: string;
  gross: number;
  refunds: number;
  fees: number | null;
  product: string;
  country: string;
}
export interface StripeRefund {
  id: string;
  chargeId: string | null;
  customerId: string | null;
  at: string;
  currency: string;
  amount: number;
  product: string;
}
export interface StripeSummary {
  health: SourceHealth;
  transactions: StripeTransaction[];
  refunds: StripeRefund[];
  subscriptionDetails: StripeSubscriptionDetail[];
  subscriptions: { plan: string; currency: string; subscribers: number; mrr: number }[];
}

export interface StripeSubscriptionDetail {
  id: string;
  userId: string | null;
  customerId: string | null;
  plan: string;
  currency: string;
  mrr: number;
}

// Same lazy-client pattern as billing, but a restricted read-only key can be supplied separately.
let stripeClient: { key: string; client: Stripe } | null = null;
function getStripe() {
  const key = process.env.STRIPE_ANALYTICS_KEY || process.env.STRIPE_SECRET_KEY;
  if (!key) return undefined;
  if (stripeClient?.key !== key)
    stripeClient = { key, client: new Stripe(key, { timeout: TIMEOUT_MS, maxNetworkRetries: 0 }) };
  return stripeClient.client;
}
const objectId = (value: string | { id: string } | null | undefined) =>
  typeof value === 'string' ? value : (value?.id ?? null);
const date = (seconds: number) => new Date(seconds * 1000).toISOString();

/** Stripe uses minor units except zero-decimal currencies. ISK/UGX are special two-decimal charge representations. */
export function stripeMajorUnits(amount: number, currency: string) {
  const decimals =
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  return amount / 10 ** (['ISK', 'UGX'].includes(currency.toUpperCase()) ? 2 : decimals);
}

async function pages<T extends { id: string }>(
  list: (cursor?: string) => Promise<Page<T>>,
  signal: AbortSignal,
) {
  const rows: T[] = [];
  let cursor: string | undefined;
  let hasMore = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    signal.throwIfAborted();
    const response = await list(cursor);
    signal.throwIfAborted();
    rows.push(...response.data);
    hasMore = response.has_more;
    if (!hasMore || !response.data.length) break;
    cursor = response.data.at(-1)?.id;
  }
  return { rows, isTruncated: hasMore };
}

/** Charges alone count revenue. Invoices classify charge/payment-intent IDs; never add invoice totals again.
 * Refunds use their own creation date, including refunds of charges before this range. MRR is a current snapshot.
 * Unknown plans stay unknown; billing checkout metadata is not always copied onto Stripe charges.
 * Customer addresses are read through charge/refund expansion. Payment-intent IDs are read from
 * charges and invoice payments solely for joining, so no second payments revenue stream is fetched.
 * Filter subscriptionDetails by DB user/customer identity before summing when excluding team accounts.
 */
export async function fetchStripe(
  range: AnalyticsRange,
  client: StripeAnalyticsClient | undefined = getStripe(),
): Promise<StripeSummary> {
  const result: StripeSummary = {
    health: health(client ? [] : ['STRIPE_ANALYTICS_KEY or STRIPE_SECRET_KEY']),
    transactions: [],
    refunds: [],
    subscriptionDetails: [],
    subscriptions: [],
  };
  if (!client) return result;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    validateRange(range);
    const created = {
      gte: Math.floor(Date.parse(range.start) / 1000),
      lt: Math.floor(Date.parse(range.end) / 1000),
    };
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('timeout'));
      }, TIMEOUT_MS);
    });
    const [charges, refunds, invoices, subscriptions] = await Promise.race([
      Promise.all([
        pages(
          (starting_after) =>
            client.charges.list({
              created,
              limit: 100,
              starting_after,
              expand: ['data.balance_transaction', 'data.customer'],
            }),
          controller.signal,
        ),
        pages(
          (starting_after) =>
            client.refunds.list({
              created,
              limit: 100,
              starting_after,
              expand: ['data.charge.customer'],
            }),
          controller.signal,
        ),
        pages(
          (starting_after) =>
            client.invoices.list({
              created,
              status: 'paid',
              limit: 100,
              starting_after,
              expand: ['data.payments'],
            }),
          controller.signal,
        ),
        pages(
          (starting_after) =>
            client.subscriptions.list({ status: 'all', limit: 100, starting_after }),
          controller.signal,
        ),
      ]),
      timeout,
    ]);
    result.health.isTruncated = [charges, refunds, invoices, subscriptions].some(
      (value) => value.isTruncated,
    );
    result.health.rowCount =
      charges.rows.length + refunds.rows.length + invoices.rows.length + subscriptions.rows.length;
    const invoiceByPayment = new Map<string, { product: string; userId: string | null }>();
    for (const invoice of invoices.rows) {
      const metadata = invoice.parent?.subscription_details?.metadata;
      const classification = {
        product: metadata?.plan || 'unknown',
        userId: metadata?.userId || null,
      };
      for (const payment of invoice.payments?.data ?? []) {
        const id = objectId(payment.payment.payment_intent) || objectId(payment.payment.charge);
        if (id) invoiceByPayment.set(id, classification);
      }
      result.health.isTruncated ||= invoice.payments?.has_more ?? false;
    }
    const chargesById = new Map(charges.rows.map((charge) => [charge.id, charge]));
    const classify = (charge: Stripe.Charge | undefined) => {
      const invoice =
        charge &&
        (invoiceByPayment.get(objectId(charge.payment_intent) || '') ||
          invoiceByPayment.get(charge.id));
      return {
        product: invoice?.product || charge?.metadata?.plan || 'unknown',
        userId: invoice?.userId || charge?.metadata?.userId || null,
      };
    };
    for (const refund of refunds.rows) {
      if (refund.status !== 'succeeded') continue;
      const chargeId = objectId(refund.charge);
      const charge =
        typeof refund.charge === 'object' && refund.charge
          ? refund.charge
          : chargesById.get(chargeId || '');
      result.refunds.push({
        id: refund.id,
        chargeId,
        customerId: objectId(charge?.customer),
        at: date(refund.created),
        currency: refund.currency.toUpperCase(),
        amount: stripeMajorUnits(refund.amount, refund.currency),
        product: classify(charge).product,
      });
    }
    for (const charge of charges.rows) {
      if (!charge.paid || charge.status !== 'succeeded' || !(charge.amount_captured > 0)) continue;
      const customer =
        typeof charge.customer === 'object' && charge.customer && !charge.customer.deleted
          ? charge.customer
          : null;
      const balance =
        typeof charge.balance_transaction === 'object' ? charge.balance_transaction : null;
      result.transactions.push({
        id: charge.id,
        ...classify(charge),
        customerId: objectId(charge.customer),
        at: date(charge.created),
        currency: charge.currency.toUpperCase(),
        gross: stripeMajorUnits(charge.amount_captured, charge.currency),
        refunds: result.refunds
          .filter((refund) => refund.chargeId === charge.id)
          .reduce((sum, refund) => sum + refund.amount, 0),
        // Settlement currency can differ; never silently mix settlement fees into charge currency.
        fees:
          balance && balance.currency === charge.currency
            ? stripeMajorUnits(balance.fee, balance.currency)
            : null,
        country: charge.billing_details.address?.country || customer?.address?.country || 'unknown',
      });
    }
    for (const subscription of subscriptions.rows) {
      if (!['active', 'trialing', 'past_due'].includes(subscription.status)) continue;
      const plan = subscription.metadata?.plan || 'unknown';
      const currencies = new Map<string, StripeSubscriptionDetail>();
      for (const item of subscription.items.data) {
        const recurring = item.price.recurring;
        if (!recurring) continue;
        const currency = item.price.currency.toUpperCase();
        const row = currencies.get(currency) || {
          id: subscription.id,
          userId: subscription.metadata?.userId || null,
          customerId: objectId(subscription.customer),
          plan,
          currency,
          mrr: 0,
        };
        const monthlyFactor =
          recurring.interval === 'year'
            ? 1 / 12
            : recurring.interval === 'week'
              ? 52 / 12
              : recurring.interval === 'day'
                ? 365.25 / 12
                : 1;
        // Trial subscribers count, but generate no current MRR until the trial ends.
        if (subscription.status !== 'trialing')
          row.mrr +=
            (stripeMajorUnits(item.price.unit_amount || 0, currency) *
              (item.quantity ?? 1) *
              monthlyFactor) /
            recurring.interval_count;
        currencies.set(currency, row);
      }
      result.subscriptionDetails.push(...currencies.values());
      result.health.isTruncated ||= subscription.items.has_more;
    }
    const grouped = new Map<string, StripeSummary['subscriptions'][number]>();
    for (const detail of result.subscriptionDetails) {
      const key = `${detail.plan}:${detail.currency}`;
      const row = grouped.get(key) || {
        plan: detail.plan,
        currency: detail.currency,
        subscribers: 0,
        mrr: 0,
      };
      row.subscribers++;
      row.mrr += detail.mrr;
      grouped.set(key, row);
    }
    result.subscriptions = [...grouped.values()];
  } catch (error) {
    controller.abort();
    result.health.error =
      error instanceof Error && error.message === 'timeout'
        ? 'Stripe request timed out; using database fallback.'
        : 'Stripe unavailable; using database fallback. Check read permissions and configuration.';
    result.transactions = [];
    result.refunds = [];
    result.subscriptionDetails = [];
    result.subscriptions = [];
  } finally {
    clearTimeout(timer);
    result.health.fetchedAt = new Date().toISOString();
  }
  return result;
}
