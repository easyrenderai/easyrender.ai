import type Stripe from 'stripe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildHogql,
  fetchPosthog,
  fetchStripe,
  type HogqlKind,
  type StripeAnalyticsClient,
  stripeMajorUnits,
} from './sources';

const range = { start: '2026-10-01T00:00:00.000Z', end: '2026-11-01T00:00:00.000Z' };
const config = { host: 'http://localhost:9999', projectId: '123', key: 'local-test-placeholder' };
const respond = (rows: unknown[][]) =>
  new Response(JSON.stringify({ results: rows }), { status: 200 });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('HogQL query construction', () => {
  it('uses exact server events, bounded results, half-open dates and Madrid bucketing', () => {
    expect(buildHogql('series', range)).toContain("toDate(toTimeZone(timestamp, 'Europe/Madrid'))");
    expect(buildHogql('series', range)).toContain(
      "timestamp < toDateTime('2026-11-01 00:00:00', 'UTC')",
    );
    expect(buildHogql('events', range)).toContain("'preview_ready', 'preview_failed', 'signup'");
    expect(buildHogql('events', range)).not.toContain("'purchase_refunded'");
    expect(buildHogql('events', range)).toContain('LIMIT 1000');
    expect(buildHogql('landing', range)).toContain('properties.$pathname');
    expect(buildHogql('referrer', range)).toContain('properties.referrer_host');
    expect(buildHogql('acquisition', range)).toContain('GROUP BY source, medium, referrer');
    expect(buildHogql('series', range, 'Etc/GMT+1')).toContain(
      "toDate(toTimeZone(timestamp, 'Etc/GMT+1'))",
    );
  });
  it('rejects dimension, date and timezone injection without escaping arbitrary input into queries', () => {
    expect(() => buildHogql('source); DROP TABLE events' as HogqlKind, range)).toThrow(
      'Unknown analytics dimension',
    );
    expect(() => buildHogql('toString' as HogqlKind, range)).toThrow('Unknown analytics dimension');
    expect(() => buildHogql('series', { ...range, start: "2026-10-01' OR 1=1" })).toThrow(
      'Invalid ISO',
    );
    expect(() => buildHogql('series', { ...range, start: '2026-99-01T00:00:00.000Z' })).toThrow();
    expect(() => buildHogql('series', { start: range.end, end: range.start })).toThrow(
      'range order',
    );
    expect(() => buildHogql('series', range, "Europe/Madrid'); SELECT 1")).toThrow(
      'Invalid timezone',
    );
  });
});

describe('PostHog adapter', () => {
  it('returns a small serializable summary, with daily visitor estimate and unfiltered scope', async () => {
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { query: { query: string } };
      if (body.query.query.includes('AS uniqueVisitors'))
        return respond([['2026-10-01', 40, 90, 35]]);
      if (body.query.query.startsWith('SELECT event'))
        return respond([
          ['signup', 7],
          ['unexpected', 999],
        ]);
      if (body.query.query.includes('GROUP BY source, medium, referrer'))
        return respond([['meta', 'paid-social', 'facebook.com', 20, 40]]);
      return respond([['example', 20, 30]]);
    });
    const result = await fetchPosthog(range, config, fetcher);
    expect(result.health).toMatchObject({
      configured: true,
      error: null,
      rowCount: 11,
      isTruncated: false,
    });
    expect(result.series).toEqual([
      { date: '2026-10-01', visits: 40, pageviews: 90, uniqueVisitors: 35 },
    ]);
    expect(result.events).toEqual([{ event: 'signup', count: 7 }]);
    expect(result.acquisition[0]).toEqual({
      source: 'meta',
      medium: 'paid-social',
      referrer: 'facebook.com',
      visits: 20,
      pageviews: 40,
    });
    expect(result.scope).toBe('unfiltered');
    expect(result.uniqueVisitorsQuality).toBe('daily-hash estimate');
    expect(JSON.stringify(result)).not.toContain(config.key);
  });
  it('returns explicit missing configuration without fetching', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const result = await fetchPosthog(range, { ...config, key: '', projectId: '' }, fetcher);
    expect(result.health).toMatchObject({
      configured: false,
      missing: ['POSTHOG_PROJECT_ID', 'POSTHOG_PERSONAL_API_KEY'],
      fetchedAt: null,
    });
    expect(result.series).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('makes 401 an empty state without forwarding upstream body or key', async () => {
    const result = await fetchPosthog(
      range,
      config,
      vi.fn<typeof fetch>(async () => new Response(config.key, { status: 401 })),
    );
    expect(result.health.error).toBe('PostHog authorization failed.');
    expect(result.series).toEqual([]);
    expect(JSON.stringify(result)).not.toContain(config.key);
  });
  it('bounds even a fetch implementation that ignores abort at eight seconds', async () => {
    vi.useFakeTimers();
    const promise = fetchPosthog(
      range,
      config,
      vi.fn<typeof fetch>(() => new Promise(() => {})),
    );
    await vi.advanceTimersByTimeAsync(8000);
    const result = await promise;
    expect(result.health.error).toBe('PostHog request timed out.');
    expect(result.events).toEqual([]);
  });
  it('handles malformed responses and untrusted project IDs as safe errors', async () => {
    const result = await fetchPosthog(
      range,
      config,
      vi.fn<typeof fetch>(async () => new Response('{}')),
    );
    expect(result.health.error).toContain('PostHog unavailable');
    const fetcher = vi.fn<typeof fetch>();
    const bad = await fetchPosthog(range, { ...config, projectId: '../other-project' }, fetcher);
    expect(bad.health.error).toContain('PostHog unavailable');
    expect(fetcher).not.toHaveBeenCalled();
  });
});

function charge(values: Partial<Stripe.Charge>): Stripe.Charge {
  return {
    id: 'ch_1',
    created: 1790812800,
    status: 'succeeded',
    paid: true,
    amount: 4900,
    captured: true,
    amount_captured: values.amount ?? 4900,
    currency: 'usd',
    customer: 'cus_1',
    metadata: {},
    billing_details: { address: null },
    balance_transaction: null,
    payment_intent: null,
    ...values,
  } as Stripe.Charge;
}
function client(
  values: {
    charges?: Stripe.Charge[];
    refunds?: Stripe.Refund[];
    invoices?: Stripe.Invoice[];
    subscriptions?: Stripe.Subscription[];
  } = {},
): StripeAnalyticsClient {
  return {
    charges: { list: vi.fn(async () => ({ data: values.charges || [], has_more: false })) },
    refunds: { list: vi.fn(async () => ({ data: values.refunds || [], has_more: false })) },
    invoices: { list: vi.fn(async () => ({ data: values.invoices || [], has_more: false })) },
    subscriptions: {
      list: vi.fn(async () => ({ data: values.subscriptions || [], has_more: false })),
    },
  };
}

describe('Stripe analytics mapping', () => {
  it('counts only captured funds, excluding uncaptured authorizations', async () => {
    const result = await fetchStripe(
      range,
      client({
        charges: [
          charge({ id: 'ch_partial', amount: 10000, amount_captured: 4000 }),
          charge({ id: 'ch_uncaptured', amount: 10000, captured: false, amount_captured: 0 }),
        ],
      }),
    );
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]).toMatchObject({ id: 'ch_partial', gross: 40 });
  });
  it('returns fallback within eight seconds when an injected client never resolves', async () => {
    vi.useFakeTimers();
    const mock = client();
    mock.charges.list = vi.fn(() => new Promise<never>(() => {}));
    const promise = fetchStripe(range, mock);
    await vi.advanceTimersByTimeAsync(8000);
    const result = await promise;
    expect(result.health.error).toBe('Stripe request timed out; using database fallback.');
    expect(result.transactions).toEqual([]);
    expect(result.subscriptionDetails).toEqual([]);
  });
  it('counts charges once, classifies with invoice metadata, keeps currencies separate and accounts refunds by refund date', async () => {
    const oldCharge = charge({ id: 'ch_old', created: 1700000000, metadata: { plan: 'payg' } });
    const result = await fetchStripe(
      range,
      client({
        charges: [
          charge({
            payment_intent: 'pi_1',
            balance_transaction: { fee: 200, currency: 'usd' } as Stripe.BalanceTransaction,
            billing_details: { address: { country: 'ES' } } as Stripe.Charge.BillingDetails,
          }),
          charge({
            id: 'ch_eur',
            currency: 'eur',
            amount: 2500,
            metadata: { userId: 'u2', plan: 'payg' },
            balance_transaction: { fee: 100, currency: 'usd' } as Stripe.BalanceTransaction,
          }),
          charge({ id: 'ch_failed', paid: false, status: 'failed' }),
        ],
        invoices: [
          {
            id: 'in_1',
            amount_paid: 4900,
            parent: { subscription_details: { metadata: { userId: 'u1', plan: 'creator' } } },
            payments: { data: [{ payment: { payment_intent: 'pi_1' } }], has_more: false },
          } as unknown as Stripe.Invoice,
        ],
        refunds: [
          {
            id: 're_1',
            charge: 'ch_1',
            status: 'succeeded',
            created: 1790899200,
            currency: 'usd',
            amount: 500,
          } as Stripe.Refund,
          {
            id: 're_old',
            charge: oldCharge,
            status: 'succeeded',
            created: 1790899200,
            currency: 'usd',
            amount: 800,
          } as Stripe.Refund,
          {
            id: 're_pending',
            charge: 'ch_1',
            status: 'pending',
            created: 1790899200,
            currency: 'usd',
            amount: 900,
          } as Stripe.Refund,
        ],
      }),
    );
    expect(result.health.error).toBeNull();
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]).toMatchObject({
      gross: 49,
      fees: 2,
      refunds: 5,
      product: 'creator',
      userId: 'u1',
      country: 'ES',
      currency: 'USD',
    });
    expect(result.transactions[1]).toMatchObject({
      gross: 25,
      fees: null,
      currency: 'EUR',
      product: 'payg',
    });
    expect(result.refunds).toHaveLength(2);
    expect(result.refunds.reduce((sum, row) => sum + row.amount, 0)).toBe(13);
    expect(result.refunds[1]).toMatchObject({
      chargeId: 'ch_old',
      customerId: 'cus_1',
      product: 'payg',
      amount: 8,
    });
  });
  it('normalizes monthly/annual subscriptions, quantities and zero-decimal currencies', async () => {
    const subscription = (
      id: string,
      status: string,
      interval: 'year' | 'month',
      currency: string,
      amount: number,
    ): Stripe.Subscription =>
      ({
        id,
        status,
        customer: `cus_${id}`,
        metadata: { plan: 'pro', userId: `user_${id}` },
        items: {
          has_more: false,
          data: [
            {
              quantity: 2,
              price: { currency, unit_amount: amount, recurring: { interval, interval_count: 1 } },
            },
          ],
        },
      }) as unknown as Stripe.Subscription;
    const result = await fetchStripe(
      range,
      client({
        subscriptions: [
          subscription('sub_1', 'active', 'year', 'usd', 12000),
          subscription('sub_2', 'trialing', 'month', 'usd', 4900),
          subscription('sub_3', 'active', 'month', 'jpy', 1000),
          subscription('sub_4', 'canceled', 'month', 'usd', 4900),
        ],
      }),
    );
    expect(result.subscriptions).toEqual([
      { plan: 'pro', currency: 'USD', subscribers: 2, mrr: 20 },
      { plan: 'pro', currency: 'JPY', subscribers: 1, mrr: 2000 },
    ]);
    expect(result.subscriptionDetails).toEqual([
      {
        id: 'sub_1',
        userId: 'user_sub_1',
        customerId: 'cus_sub_1',
        plan: 'pro',
        currency: 'USD',
        mrr: 20,
      },
      {
        id: 'sub_2',
        userId: 'user_sub_2',
        customerId: 'cus_sub_2',
        plan: 'pro',
        currency: 'USD',
        mrr: 0,
      },
      {
        id: 'sub_3',
        userId: 'user_sub_3',
        customerId: 'cus_sub_3',
        plan: 'pro',
        currency: 'JPY',
        mrr: 2000,
      },
    ]);
    expect(stripeMajorUnits(12345, 'kwd')).toBe(12.345);
    expect(stripeMajorUnits(10000, 'isk')).toBe(100);
  });
  it('preserves unavailable fees as null instead of presenting a measured zero', async () => {
    const result = await fetchStripe(
      range,
      client({ charges: [charge({ balance_transaction: null })] }),
    );
    expect(result.transactions[0].fees).toBeNull();
  });
  it('paginates with cursors and marks an incomplete bounded snapshot', async () => {
    const mock = client();
    mock.charges.list = vi.fn(async (params) => ({
      data: [charge({ id: `ch_${params.starting_after || 'start'}_next` })],
      has_more: true,
    }));
    const result = await fetchStripe(range, mock);
    expect(result.transactions).toHaveLength(10);
    expect(result.transactions[1].id).toBe('ch_ch_start_next_next');
    expect(result.health.isTruncated).toBe(true);
  });
  it('returns safe DB fallback errors and missing configuration', async () => {
    const mock = client();
    mock.charges.list = vi.fn(async () => {
      throw new Error('sensitive upstream response');
    });
    const result = await fetchStripe(range, mock);
    expect(result.health.error).toContain('database fallback');
    expect(JSON.stringify(result)).not.toContain('sensitive');
    expect(result.transactions).toEqual([]);
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    vi.stubEnv('STRIPE_ANALYTICS_KEY', '');
    expect((await fetchStripe(range)).health).toMatchObject({
      configured: false,
      missing: ['STRIPE_ANALYTICS_KEY or STRIPE_SECRET_KEY'],
    });
  });
});
