import type { PosthogDelivery } from '@easyrender/db';
import { pricingFor } from '@easyrender/harness';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { eventUuid, setAnalyticsScheduler } from './analytics';
import { checkoutAttributionMetadata, normalizeAttribution } from './attribution';
import { capturePurchase, confirmedPurchase, handleStripeWebhook } from './billing';
import { sendPosthogEvent } from './posthog-outbox';

const state = vi.hoisted(() => ({
  purchase: {
    id: 'purchase-fixture',
    userId: 'owner',
    stripeSessionId: 'cs_fixture',
    status: 'pending',
    packId: 'payg',
    credits: 500,
    amountCents: 500,
    currency: 'eur',
    paidAt: null as Date | null,
  },
  rows: new Map<string, PosthogDelivery>(),
  session: {} as Record<string, unknown>,
  invoice: {} as Record<string, unknown>,
  eventType: 'checkout.session.completed',
  hasGoogleDelivery: false,
  hasGoogleCheckout: false,
  retrieve: vi.fn(),
  list: vi.fn(),
  grant: vi.fn(),
}));
vi.mock('./credits', () => ({ grantCredits: state.grant }));
vi.mock('./report', () => ({ reportError: vi.fn() }));
vi.mock('./pricing-experiment', async (original) => ({
  ...(await original<typeof import('./pricing-experiment')>()),
  pricingSubject: async () => null,
}));
vi.mock('stripe', () => ({
  default: class {
    checkout = { sessions: { retrieve: state.retrieve, list: state.list } };
    invoices = { retrieve: async () => state.invoice };
    webhooks = {
      constructEventAsync: async () => ({
        type: state.eventType,
        created: 1795262400,
        data: { object: state.eventType === 'invoice.paid' ? state.invoice : state.session },
      }),
    };
  },
}));
vi.mock('@easyrender/db', () => ({
  db: () => ({
    user: {
      findUnique: async () => normalizeAttribution(null, 'https://easyrender.ai'),
      findUniqueOrThrow: async () => normalizeAttribution(null, 'https://easyrender.ai'),
      update: async () => ({}),
    },
    purchase: {
      findUnique: async ({ where }: { where: { stripeSessionId?: string } }) =>
        !where.stripeSessionId || where.stripeSessionId === state.purchase.stripeSessionId
          ? state.purchase
          : null,
      findUniqueOrThrow: async () => state.purchase,
      findFirst: async ({
        where,
      }: {
        where: { userId: string; stripeSessionId: string; status: string };
      }) =>
        Object.entries(where).every(
          ([key, value]) => state.purchase[key as keyof typeof state.purchase] === value,
        )
          ? state.purchase
          : null,
      upsert: async () => state.purchase,
      updateMany: async ({ data }: { data: Partial<typeof state.purchase> }) => {
        Object.assign(state.purchase, data);
        return { count: 1 };
      },
    },
    $queryRaw: async () => [{ id: state.purchase.id }],
    posthogDelivery: {
      upsert: async ({ create }: { create: PosthogDelivery }) => {
        if (!state.rows.has(create.id)) state.rows.set(create.id, create);
        return state.rows.get(create.id);
      },
      findUnique: async ({ where }: { where: { id: string } }) => state.rows.get(where.id) ?? null,
    },
    googleCheckout: {
      findFirst: async () => (state.hasGoogleCheckout ? { id: 'cs_fixture' } : null),
    },
    googlePurchaseDelivery: {
      findUnique: async () => (state.hasGoogleDelivery ? { purchaseId: state.purchase.id } : null),
    },
  }),
}));

beforeEach(() => {
  state.rows.clear();
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'fixture-public-key');
  vi.stubEnv('STRIPE_SECRET_KEY', 'local-only');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'local-only');
  vi.stubEnv('GA_MEASUREMENT_API_SECRET', '');
  setAnalyticsScheduler(() => undefined);
  state.hasGoogleDelivery = false;
  state.hasGoogleCheckout = false;
  Object.assign(state.purchase, {
    status: 'pending',
    paidAt: null,
    stripeSessionId: 'cs_fixture',
    packId: 'payg',
  });
  state.eventType = 'checkout.session.completed';
  state.session = {
    id: 'cs_fixture',
    mode: 'payment',
    payment_status: 'paid',
    client_reference_id: 'owner',
    amount_total: state.purchase.amountCents,
    currency: 'eur',
    customer_details: { address: { country: 'ES' } },
    metadata: {
      ui_locale: 'es',
      ...checkoutAttributionMetadata({
        landing_path: '/es',
        referrer_host: 'www.google.com',
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'launch',
        utm_term: '3d',
        utm_content: 'photo',
        posthog_distinct_id: 'browser-fixture',
        posthog_session_id: '019a0000-0000-7000-8000-000000000001',
        gclid: 'Ad_123',
      }),
    },
  };
  state.retrieve.mockImplementation(async () => state.session);
  state.list.mockImplementation(async () => ({ data: [state.session] }));
});
afterEach(() => vi.unstubAllEnvs());

it('propagates paid Stripe metadata into both compatible PostHog events and replays without another delivery', async () => {
  await handleStripeWebhook('signed-fixture', 'signature');
  await handleStripeWebhook('signed-fixture', 'signature');
  expect(state.rows.size).toBe(2);
  for (const event of ['purchase', 'purchase_completed']) {
    const row = state.rows.get(eventUuid(`${event}:${state.purchase.id}`));
    expect(row).toMatchObject({
      event,
      distinctId: 'browser-fixture',
      subjectId: state.purchase.id,
      properties: {
        $session_id: '019a0000-0000-7000-8000-000000000001',
        landing_path: '/es',
        ft_landing_path: '/es',
        referrer_host: 'www.google.com',
        ft_referrer: 'www.google.com',
        utm_source: 'google',
        ft_utm_source: 'google',
        gclid: 'Ad_123',
        $geoip_country_code: 'ES',
        country: 'ES',
        ui_locale: 'es',
        revenue: state.purchase.amountCents / 100,
        currency: 'EUR',
        credits: state.purchase.credits,
        stripe_session_id: 'cs_fixture',
        plan: 'payg',
      },
    });
    const fetcher = vi.fn(async () => new Response('{}'));
    expect(await sendPosthogEvent(row as PosthogDelivery, fetcher)).toBe('delivered');
    const args = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
    expect(JSON.parse(String(args[1].body)).batch[0]).toMatchObject({
      distinct_id: 'browser-fixture',
      uuid: row?.id,
      properties: {
        $session_id: '019a0000-0000-7000-8000-000000000001',
        $geoip_country_code: 'ES',
      },
    });
  }
});

it('keeps userId fallback for legacy/no-consent checkouts without browser or advertising identifiers', async () => {
  state.session.metadata = {};
  await handleStripeWebhook('signed-fixture', 'signature');
  const row = state.rows.get(eventUuid(`purchase_completed:${state.purchase.id}`));
  expect(row?.distinctId).toBe('owner');
  expect(row?.properties).not.toHaveProperty('$session_id');
  expect(row?.properties).not.toHaveProperty('gclid');
});

it('never reports unpaid checkouts or exposes another owner’s purchase', async () => {
  state.session.payment_status = 'unpaid';
  await handleStripeWebhook('signed-fixture', 'signature');
  expect(state.rows.size).toBe(0);
  expect(await confirmedPurchase('owner', 'cs_fixture', true)).toBeNull();
  state.session.payment_status = 'paid';
  await handleStripeWebhook('signed-fixture', 'signature');
  expect(await confirmedPurchase('someone-else', 'cs_fixture', true)).toBeNull();
});

it('confirms with the Stripe transaction ID and exact dedup envelope, withholding IDs and click data without permission', async () => {
  await handleStripeWebhook('signed-fixture', 'signature');
  state.hasGoogleDelivery = true;
  const confirmation = await confirmedPurchase('owner', 'cs_fixture', true, true);
  expect(confirmation).toMatchObject({
    server_managed: true,
    transaction_id: 'cs_fixture',
    posthog: {
      id: eventUuid(`purchase_completed:${state.purchase.id}`),
      distinctId: 'browser-fixture',
      occurredAt: state.purchase.paidAt?.toISOString(),
      properties: { gclid: 'Ad_123' },
    },
  });
  expect((await confirmedPurchase('owner', 'cs_fixture', false))?.posthog).toBeNull();
  expect(
    (await confirmedPurchase('owner', 'cs_fixture', true, false))?.posthog?.properties,
  ).not.toHaveProperty('gclid');
});

it.each(['invoice-first', 'checkout-first'] as const)(
  'attributes the initial subscription in %s ordering without tagging renewals',
  async (order) => {
    Object.assign(state.purchase, { stripeSessionId: 'in_fixture', packId: 'pro' });
    state.session = { ...state.session, mode: 'subscription', invoice: 'in_fixture' };
    state.invoice = {
      id: 'in_fixture',
      billing_reason: 'subscription_create',
      currency: 'eur',
      amount_paid: pricingFor('control').plans.pro.priceCents,
      parent: {
        subscription_details: {
          subscription: 'sub_fixture',
          metadata: { userId: 'owner', plan: 'pro' },
        },
      },
    };
    for (const type of order === 'invoice-first'
      ? ['invoice.paid', 'checkout.session.completed']
      : ['checkout.session.completed', 'invoice.paid']) {
      state.eventType = type;
      await handleStripeWebhook('signed-fixture', 'signature');
    }
    expect(state.rows.get(eventUuid(`purchase_completed:${state.purchase.id}`))?.distinctId).toBe(
      'browser-fixture',
    );
    expect((await confirmedPurchase('owner', 'cs_fixture', true))?.transaction_id).toBe(
      'cs_fixture',
    );
    state.rows.clear();
    state.invoice.billing_reason = 'subscription_cycle';
    await capturePurchase(state.purchase.id, true);
    expect(state.rows.get(eventUuid(`purchase_completed:${state.purchase.id}`))?.distinctId).toBe(
      'owner',
    );
    expect(
      state.rows.get(eventUuid(`purchase_completed:${state.purchase.id}`))?.properties,
    ).not.toHaveProperty('$session_id');
  },
);

it('recovery reads the checkout metadata after a missed enqueue rather than dropping the browser context', async () => {
  Object.assign(state.purchase, { status: 'paid', paidAt: new Date('2026-11-21T12:00:00Z') });
  await capturePurchase(state.purchase.id, true);
  expect(state.rows.get(eventUuid(`purchase_completed:${state.purchase.id}`))?.distinctId).toBe(
    'browser-fixture',
  );
});

it('marks an eligible server Google checkout as managed before the outbox row exists', async () => {
  Object.assign(state.purchase, { status: 'paid', paidAt: new Date() });
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubEnv('GA_MEASUREMENT_ID', 'G-TEST');
  vi.stubEnv('GA_MEASUREMENT_API_SECRET', 'fixture-secret');
  state.hasGoogleCheckout = true;
  expect((await confirmedPurchase('owner', 'cs_fixture'))?.server_managed).toBe(true);
  state.hasGoogleCheckout = false;
  expect((await confirmedPurchase('owner', 'cs_fixture'))?.server_managed).toBe(false);
});

it('defers initial invoice attribution until Stripe attaches the checkout invoice, then repairs from checkout completion', async () => {
  Object.assign(state.purchase, { stripeSessionId: 'in_fixture', packId: 'pro' });
  state.session = { ...state.session, mode: 'subscription', invoice: 'in_fixture' };
  state.invoice = {
    id: 'in_fixture',
    billing_reason: 'subscription_create',
    currency: 'eur',
    parent: {
      subscription_details: {
        subscription: 'sub_fixture',
        metadata: { userId: 'owner', plan: 'pro' },
      },
    },
  };
  state.list.mockResolvedValueOnce({ data: [] });
  state.eventType = 'invoice.paid';
  await handleStripeWebhook('signed-fixture', 'signature');
  expect(state.purchase.status).toBe('paid');
  expect(state.rows.size).toBe(0);
  state.eventType = 'checkout.session.completed';
  await handleStripeWebhook('signed-fixture', 'signature');
  expect(state.rows.get(eventUuid(`purchase_completed:${state.purchase.id}`))?.distinctId).toBe(
    'browser-fixture',
  );
});
