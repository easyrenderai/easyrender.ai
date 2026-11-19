import { writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { gunzipSync } from 'node:zlib';
import { db } from '@easyrender/db';
import { pricingFor, RENDER_CREDITS, SUBSCRIPTION_PLANS } from '@easyrender/harness';
import Stripe from 'stripe';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eventUuid, setAnalyticsScheduler } from './analytics';
import { reconcileBusinessAnalytics } from './analytics-recovery';
import { classifyCountry, normalizeAttribution } from './attribution';
import { confirmedPurchase, handleStripeWebhook } from './billing';
import { listCatalog, submitCatalog, tickCatalog } from './catalog';
import { flushPosthogEvents } from './posthog-outbox';
import { advance, createDraft, startBuild } from './renders';
import { signupAttribution } from './signup-attribution';

const url = process.env.TEST_DATABASE_URL;
if (url) {
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
    throw new Error('Analytics integration tests require a local throwaway database');
  process.env.DATABASE_URL = url;
}
const provider = vi.hoisted(() => ({
  hasFailure: false,
  get: vi.fn(),
  sequence: 0,
  predictions: new Map<string, string>(),
}));
vi.mock('@easyrender/harness', async (original) => ({
  ...(await original<typeof import('@easyrender/harness')>()),
  checkPhoto: async () => ({
    ok: true,
    warnings: [],
    measures: { width: 1000, height: 1000, spread: 50, sharpness: 10 },
  }),
  checkSheet: async () => ({
    ok: true,
    warnings: [],
    measures: { side: 2048, emptyCells: 0, repeatedViews: 0, closestViews: 0.1 },
  }),
  checkGlb: () => ({ ok: true, warnings: [], measures: { bytes: 50000 } }),
  download: async () => new Uint8Array(50000),
  cutCells: async () => [new Uint8Array([1])],
  createReplicate: () => ({
    upload: async () => {
      if (provider.hasFailure) throw new Error('forced provider failure');
      return 'https://provider.invalid/photo';
    },
    start: async (path: string) => {
      const id = `qa_prediction_${crypto.randomUUID()}`;
      provider.predictions.set(id, path);
      return { id };
    },
    get: provider.get,
  }),
}));
vi.mock('./storage', () => ({
  putFile: async (path: string) => `local-mock:${path}`,
  getFile: async () => new Uint8Array([1]),
}));
vi.mock('./remote-image', () => ({
  fetchRemoteImage: async () => ({ bytes: new Uint8Array([1]), contentType: 'image/png' }),
}));

type Captured = {
  event: string;
  uuid: string;
  properties: Record<string, unknown>;
  distinct_id: string;
};
const events: Captured[] = [];
const pending: (() => Promise<void>)[] = [];
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks);
  const body = JSON.parse(
    (request.headers['content-encoding'] === 'gzip' ? gunzipSync(raw) : raw).toString(),
  );
  events.push(...(body.batch ?? [body]));
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end('{}');
});
const drain = async () => {
  while (pending.length) await pending.shift()?.();
};
const ft = () =>
  normalizeAttribution(
    {
      utm_source: 'TEST',
      utm_medium: 'QA',
      utm_campaign: 'req02-t1',
      landing_path: '/?gclid=abc',
      referrer: 'https://referrer.test/path?token=secret',
      gclid: 'abc',
    },
    'http://localhost:3100',
    classifyCountry('DE'),
  );
const newUser = async () => {
  const id = `analytics_${crypto.randomUUID()}`;
  await db().user.create({
    data: { id, name: 'Local QA', email: `${id}@example.invalid`, credits: RENDER_CREDITS * 3 },
  });
  return id;
};
const selected = (id: string, prefix: string) =>
  events
    .filter((e) => e.properties?.preview_id === id && e.event.startsWith(prefix))
    .map((e) => e.event)
    .sort();

describe.skipIf(!url)('analytics through real server functions and local Postgres', () => {
  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing mock port');
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_localtest';
    process.env.POSTHOG_HOST = `http://127.0.0.1:${address.port}`;
    process.env.SHEET_ENABLED = 'true';
    process.env.REPLICATE_API_TOKEN = 'test';
    process.env.STRIPE_SECRET_KEY = 'sk_test_local';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_local';
    delete process.env.HARNESS_GITHUB_TOKEN;
    setAnalyticsScheduler((work) => pending.push(work));
  });
  afterAll(async () => {
    await drain();
    if (process.env.EVIDENCE_DIR)
      await writeFile(
        `${process.env.EVIDENCE_DIR}/server-integration-events.json`,
        JSON.stringify(events, null, 2),
      );
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db().$disconnect();
  });
  it('stores preview first touch, copies it at signup, does not overwrite and closes each stage once', async () => {
    provider.hasFailure = false;
    const anonId = crypto.randomUUID();
    const preview = await createDraft({
      actor: { anonId },
      bytes: new Uint8Array([1]),
      contentType: 'image/png',
      attribution: ft(),
    });
    expect(preview).toMatchObject({
      utm_source: 'test',
      utm_campaign: 'req02-t1',
      landing_path: '/',
      geo_country: 'DE',
      consent_region_at_create: 'strict',
      referrer: 'https://referrer.test/path',
    });
    provider.get.mockResolvedValue({
      status: 'succeeded',
      output: 'https://provider.invalid/sheet.png',
    });
    await Promise.all([advance(preview.id), advance(preview.id)]);
    expect(
      await db().posthogDelivery.findUnique({
        where: { id: eventUuid(`preview_ready:${preview.id}`) },
      }),
    ).toMatchObject({ event: 'preview_ready' });
    const userId = await newUser();
    await signupAttribution({
      userId,
      anonId,
      attribution: normalizeAttribution({ utm_campaign: 'second' }, 'http://localhost'),
      method: 'email',
    });
    await signupAttribution({
      userId,
      anonId,
      attribution: normalizeAttribution({ utm_campaign: 'third' }, 'http://localhost'),
      method: 'email',
    });
    expect(await db().user.findUniqueOrThrow({ where: { id: userId } })).toMatchObject({
      utm_campaign: 'req02-t1',
      geo_country: 'DE',
    });
    await startBuild(preview.id, { userId }); // straight to 3D, on the preview sheet
    provider.get.mockResolvedValue({
      status: 'succeeded',
      output: 'https://provider.invalid/model.glb',
    });
    await Promise.all([advance(preview.id), advance(preview.id)]);
    const completed = await db().render.findUniqueOrThrow({ where: { id: preview.id } });
    await db().posthogDelivery.deleteMany({
      where: {
        id: {
          in: [eventUuid(`render_ready:${preview.id}`), eventUuid(`preview_ready:${preview.id}`)],
        },
      },
    });
    await reconcileBusinessAnalytics();
    await flushPosthogEvents({
      eventIds: [eventUuid(`render_ready:${preview.id}`), eventUuid(`preview_ready:${preview.id}`)],
    });
    expect(
      await db().posthogDelivery.findUnique({
        where: { id: eventUuid(`render_ready:${preview.id}`) },
      }),
    ).toMatchObject({ occurredAt: completed.completedAt });
    expect(
      await db().posthogDelivery.findUnique({
        where: { id: eventUuid(`preview_ready:${preview.id}`) },
      }),
    ).toMatchObject({ event: 'preview_ready' });
    await drain();
    expect(
      (await db().render.findUniqueOrThrow({ where: { id: preview.id } })).quality,
    ).toMatchObject({
      photo: { width: 1000 },
      draftSheet: { side: 2048 },
      glb: { bytes: 50000 },
    });
    expect(selected(preview.id, 'preview_')).toEqual(['preview_ready', 'preview_start']);
    expect(selected(preview.id, 'render_')).toEqual(['render_ready', 'render_start']);
    const signup = events.filter((e) => e.event === 'signup' && e.properties.user_id === userId);
    expect(signup).toHaveLength(1);
    expect(signup[0]).toMatchObject({
      distinct_id: userId,
      properties: {
        had_preview_before: true,
        preview_id_before: preview.id,
        ft_utm_campaign: 'req02-t1',
      },
    });
    expect(
      events.some((e) => e.event === '$create_alias' && e.properties.alias === `pv_${preview.id}`),
    ).toBe(true);
  });
  it('retains quality and emits one render completion when the build runs on the preview sheet', async () => {
    provider.hasFailure = false;
    const userId = await newUser();
    const render = await createDraft({
      actor: { userId },
      bytes: new Uint8Array([1]),
      contentType: 'image/png',
      attribution: ft(),
    });
    provider.get.mockResolvedValue({
      status: 'succeeded',
      output: 'https://provider.invalid/sheet.png',
    });
    await advance(render.id);
    await startBuild(render.id, { userId });
    provider.get.mockResolvedValue({
      status: 'succeeded',
      output: 'https://provider.invalid/model.glb',
    });
    await Promise.all([advance(render.id), advance(render.id)]);
    await drain();
    const done = await db().render.findUniqueOrThrow({ where: { id: render.id } });
    expect(done).toMatchObject({
      status: 'ready',
      quality: { photo: { width: 1000 }, draftSheet: { side: 2048 }, glb: { bytes: 50000 } },
    });
    // No second sheet was drawn, so none is recorded.
    expect(done.quality).not.toHaveProperty('finalSheet');
    expect(selected(render.id, 'render_')).toEqual(['render_ready', 'render_start']);
    expect((await db().user.findUniqueOrThrow({ where: { id: userId } })).credits).toBe(
      RENDER_CREDITS * 2,
    );
  });
  it('forced preview and model provider failures each emit exactly one failure and refund the model', async () => {
    const userId = await newUser();
    const anonId = crypto.randomUUID();
    provider.hasFailure = true;
    await expect(
      createDraft({
        actor: { anonId },
        bytes: new Uint8Array([1]),
        contentType: 'image/png',
        attribution: ft(),
      }),
    ).rejects.toMatchObject({ code: 'upstream' });
    const preview = await db().render.findFirstOrThrow({ where: { anonId } });
    await advance(preview.id);
    provider.hasFailure = false;
    const model = await createDraft({
      actor: { userId },
      bytes: new Uint8Array([1]),
      contentType: 'image/png',
      attribution: ft(),
    });
    provider.get.mockResolvedValue({
      status: 'succeeded',
      output: 'https://provider.invalid/sheet.png',
    });
    await advance(model.id);
    provider.hasFailure = true;
    const before = (await db().user.findUniqueOrThrow({ where: { id: userId } })).credits;
    await expect(startBuild(model.id, { userId })).rejects.toMatchObject({ code: 'upstream' });
    await advance(model.id);
    expect((await db().user.findUniqueOrThrow({ where: { id: userId } })).credits).toBe(before);
    await drain();
    expect(selected(preview.id, 'preview_')).toEqual(['preview_failed', 'preview_start']);
    expect(selected(model.id, 'render_')).toEqual(['render_failed', 'render_start']);
  });
  it.each([
    ['shopify', true],
    ['woocommerce', true],
    ['shopify', false],
    ['woocommerce', false],
  ] as const)(
    'catalogue %s with sheets=%s preserves API events and null-safe attribution',
    async (platform, hasSheet) => {
      provider.hasFailure = false;
      // Concurrent ticks may reach the next stage in either order. Each prediction must
      // return its own model's output, just as the real provider does.
      provider.get.mockImplementation(async (id: string) => ({
        status: 'succeeded',
        output:
          provider.predictions.get(id) === '/predictions'
            ? 'https://provider.invalid/model.glb'
            : 'https://provider.invalid/sheet.png',
      }));
      process.env.SHEET_ENABLED = String(hasSheet);
      try {
        const userId = await newUser();
        const scope = { userId, platform, store: 'analytics.example.invalid' };
        await submitCatalog(
          scope,
          [{ externalId: 'chair', title: 'Chair', imageUrl: 'https://store.invalid/chair.png' }],
          RENDER_CREDITS,
        );
        const render = await db().render.findFirstOrThrow({ where: { userId } });
        expect(render).toMatchObject({
          source: 'api',
          isLinkShared: true,
          isPublic: false,
          utm_source: null,
          geo_country: null,
          consent_region_at_create: 'strict',
        });
        expect(render.first_seen_at).not.toBeNull();
        await Promise.all([tickCatalog(scope), tickCatalog(scope)]);
        if (hasSheet) await tickCatalog(scope); // final sheet -> 3D
        await Promise.all([tickCatalog(scope), tickCatalog(scope)]);
        expect((await listCatalog(scope)).items[0]).toMatchObject({
          state: 'ready',
          renderId: render.id,
        });
        await drain();
        expect(selected(render.id, 'preview_')).toEqual(
          hasSheet ? ['preview_ready', 'preview_start'] : [],
        );
        expect(selected(render.id, 'render_')).toEqual(['render_ready', 'render_start']);
        for (const event of events.filter((event) => event.properties?.preview_id === render.id)) {
          expect(event.properties).toMatchObject({
            source_channel: 'api',
            ft_utm_source: null,
            geo_country: null,
            consent_region: 'strict',
          });
        }
        expect(
          events.find(
            (event) => event.event === 'render_ready' && event.properties.preview_id === render.id,
          )?.properties.in_public_gallery,
        ).toBe(false);
        expect((await db().user.findUniqueOrThrow({ where: { id: userId } })).credits).toBe(
          RENDER_CREDITS * 2,
        );
      } finally {
        process.env.SHEET_ENABLED = 'true';
      }
    },
  );
  it.each(['preview', 'render'] as const)(
    'catalogue %s failure emits once under concurrent ticks and refunds any spend',
    async (stage) => {
      provider.hasFailure = false;
      const userId = await newUser();
      const scope = {
        userId,
        platform: 'woocommerce' as const,
        store: 'analytics.example.invalid',
      };
      await submitCatalog(
        scope,
        [{ externalId: 'chair', title: 'Chair', imageUrl: 'https://store.invalid/chair.png' }],
        RENDER_CREDITS,
      );
      const render = await db().render.findFirstOrThrow({ where: { userId } });
      if (stage === 'render') {
        provider.get.mockResolvedValue({
          status: 'succeeded',
          output: 'https://provider.invalid/sheet.png',
        });
        await tickCatalog(scope);
        await tickCatalog(scope);
      }
      provider.get.mockResolvedValue({ status: 'failed', error: 'forced catalogue failure' });
      await Promise.all([tickCatalog(scope), tickCatalog(scope)]);
      expect((await listCatalog(scope)).items[0]?.state).toBe('failed');
      await drain();
      expect(selected(render.id, `${stage}_`)).toEqual([`${stage}_failed`, `${stage}_start`]);
      expect(
        events.find(
          (event) => event.event === `${stage}_failed` && event.properties.preview_id === render.id,
        )?.properties,
      ).toMatchObject({ source_channel: 'api', failure_reason: 'generation_failed' });
      expect((await db().user.findUniqueOrThrow({ where: { id: userId } })).credits).toBe(
        RENDER_CREDITS * 3,
      );
    },
  );
  it('accepts a signed confirmed webhook once, rejects unpaid and bad signatures, scopes the GA return value', async () => {
    const userId = await newUser();
    await signupAttribution({ userId, anonId: null, attribution: ft(), method: 'email' });
    const sessionId = `cs_local_${crypto.randomUUID()}`;
    const purchase = await db().purchase.create({
      data: { userId, stripeSessionId: sessionId, packId: 'payg', credits: 500, amountCents: 500 },
    });
    const eventCreated = Math.floor(Date.now() / 1000) - 3600;
    const send = async (status: string, created = eventCreated) => {
      const body = JSON.stringify({
        id: `evt_${sessionId}`,
        type: 'checkout.session.completed',
        created,
        data: {
          object: {
            id: sessionId,
            mode: 'payment',
            payment_status: status,
            currency: 'usd',
            client_reference_id: userId,
          },
        },
      });
      const signature = new Stripe('sk_test_local').webhooks.generateTestHeaderString({
        payload: body,
        secret: 'whsec_local',
      });
      return handleStripeWebhook(body, signature);
    };
    await send('unpaid');
    await drain();
    expect(
      events.filter((e) => e.event === 'purchase' && e.properties.order_id === purchase.id),
    ).toHaveLength(0);
    await send('paid');
    const recorded = await db().purchase.findUniqueOrThrow({ where: { id: purchase.id } });
    expect(recorded.paidAt).toEqual(new Date(eventCreated * 1000));
    // Simulate an enqueue lost after the paid state committed, then repair on signed replay.
    await db().posthogDelivery.deleteMany({ where: { id: eventUuid(`purchase:${purchase.id}`) } });
    await send('paid', eventCreated + 3600);
    expect((await db().purchase.findUniqueOrThrow({ where: { id: purchase.id } })).paidAt).toEqual(
      recorded.paidAt,
    );
    expect(
      await db().posthogDelivery.findUnique({
        where: { id: eventUuid(`purchase:${purchase.id}`) },
      }),
    ).toMatchObject({ occurredAt: recorded.paidAt });
    await drain();
    const captures = events.filter(
      (e) => e.event === 'purchase' && e.properties.order_id === purchase.id,
    );
    expect(captures).toHaveLength(1);
    expect(captures[0].properties).toMatchObject({
      amount: 5,
      currency: 'USD',
      pack_id: 'payg',
      credits: 500,
      is_first_purchase: true,
      ft_utm_campaign: 'req02-t1',
    });
    expect(await confirmedPurchase(userId, sessionId)).toMatchObject({
      transaction_id: purchase.id,
      value: 5,
      currency: 'USD',
      items: [{ item_id: 'payg' }],
    });
    expect(await confirmedPurchase('other-user', sessionId)).toBeNull();
    await expect(handleStripeWebhook('{}', 'bad')).rejects.toThrow();
  });
  it.each([
    ['scale', 'creator', 1200],
    ['creator', 'scale', 8500],
    ['scale', 'creator', 0],
  ] as const)(
    'credits and captures the invoice plan after %s to %s portal switch (paid %s cents)',
    async (checkoutPlan, invoicePlan, amountPaid) => {
      process.env.STRIPE_PRICE_CREATOR = 'price_creator';
      process.env.STRIPE_PRICE_SCALE = 'price_scale';
      const userId = await newUser();
      const invoiceId = `in_local_${crypto.randomUUID()}`;
      const body = JSON.stringify({
        id: `evt_${invoiceId}`,
        type: 'invoice.paid',
        data: {
          object: {
            id: invoiceId,
            amount_paid: amountPaid,
            currency: 'usd',
            parent: { subscription_details: { metadata: { userId, plan: checkoutPlan } } },
            lines: {
              data: [
                {
                  parent: { subscription_item_details: { proration: true } },
                  pricing: { price_details: { price: `price_${checkoutPlan}` } },
                },
                {
                  parent: { subscription_item_details: { proration: false } },
                  pricing: { price_details: { price: `price_${invoicePlan}` } },
                },
              ],
            },
          },
        },
      });
      const signature = new Stripe('sk_test_local').webhooks.generateTestHeaderString({
        payload: body,
        secret: 'whsec_local',
      });
      await Promise.all([
        handleStripeWebhook(body, signature),
        handleStripeWebhook(body, signature),
      ]);
      await handleStripeWebhook(body, signature);
      await drain();
      const purchase = await db().purchase.findUniqueOrThrow({
        where: { stripeSessionId: invoiceId },
      });
      expect(purchase).toMatchObject({
        status: 'paid',
        packId: invoicePlan,
        credits: SUBSCRIPTION_PLANS[invoicePlan].monthlyCredits,
        amountCents: amountPaid,
      });
      expect((await db().user.findUniqueOrThrow({ where: { id: userId } })).credits).toBe(
        RENDER_CREDITS * 3 + SUBSCRIPTION_PLANS[invoicePlan].monthlyCredits,
      );
      const ledger = await db().creditLedger.findMany({ where: { userId } });
      expect(ledger).toHaveLength(1);
      expect(ledger[0]).toMatchObject({
        purchaseId: purchase.id,
        delta: SUBSCRIPTION_PLANS[invoicePlan].monthlyCredits,
        reason: 'subscription',
      });
      const purchases = events.filter(
        (event) => event.event === 'purchase' && event.properties.order_id === purchase.id,
      );
      expect(purchases).toHaveLength(1);
      expect(purchases[0].properties).toMatchObject({
        pack_id: invoicePlan,
        credits: SUBSCRIPTION_PLANS[invoicePlan].monthlyCredits,
        amount: amountPaid / 100,
        currency: 'USD',
        is_first_purchase: true,
      });
      expect(await confirmedPurchase(userId, invoiceId)).toMatchObject({
        transaction_id: purchase.id,
        value: amountPaid / 100,
        items: [{ item_id: invoicePlan, price: amountPaid / 100 }],
      });
    },
  );
  it('keeps test renewal credits and revenue after shutdown, once across webhook replays', async () => {
    process.env.STRIPE_PRICE_PRO_TEST = 'price_pro_test';
    process.env.PRICING_AB_ENABLED = '0';
    const userId = await newUser();
    const invoiceId = `in_test_${crypto.randomUUID()}`;
    const body = JSON.stringify({
      id: `evt_${invoiceId}`,
      type: 'invoice.paid',
      data: {
        object: {
          id: invoiceId,
          amount_paid: 7900,
          currency: 'usd',
          parent: {
            subscription_details: {
              metadata: {
                userId,
                plan: 'pro',
                pricing_variant: 'test',
                pricing_flag: 'pricing-test-2026-11',
              },
            },
          },
          lines: {
            data: [
              {
                parent: { subscription_item_details: { proration: false } },
                pricing: { price_details: { price: 'price_pro_test' } },
              },
            ],
          },
        },
      },
    });
    const signature = new Stripe('sk_test_local').webhooks.generateTestHeaderString({
      payload: body,
      secret: 'whsec_local',
    });
    await Promise.all([handleStripeWebhook(body, signature), handleStripeWebhook(body, signature)]);
    await handleStripeWebhook(body, signature);
    await drain();
    const purchase = await db().purchase.findUniqueOrThrow({
      where: { stripeSessionId: invoiceId },
    });
    expect(purchase).toMatchObject({
      status: 'paid',
      packId: 'pro:test',
      credits: 4500,
      amountCents: 7900,
    });
    expect((await db().user.findUniqueOrThrow({ where: { id: userId } })).credits).toBe(
      RENDER_CREDITS * 3 + pricingFor('test').plans.pro.monthlyCredits,
    );
    expect(await db().creditLedger.count({ where: { userId } })).toBe(1);
    const captured = events.filter(
      (event) => event.event === 'purchase_completed' && event.properties.order_id === purchase.id,
    );
    expect(captured).toHaveLength(1);
    expect(captured[0].properties).toMatchObject({
      pricing_variant: 'test',
      revenue: 79,
      currency: 'USD',
    });
    expect(await confirmedPurchase(userId, invoiceId)).toMatchObject({
      pricing_variant: 'test',
      value: 79,
    });
    expect(await confirmedPurchase('other-user', invoiceId)).toBeNull();
  });
  it('stores truncated garbage values without rejecting signup and never overwrites direct first touch', async () => {
    const userId = await newUser();
    const attribution = normalizeAttribution(
      {
        utm_source: '',
        utm_campaign: 'Ä!'.repeat(150),
        landing_path: '/signup?ttclid=hidden',
        referrer: 'https://external.test/path?token=hidden',
        msclkid: 'hidden',
      },
      'http://localhost',
      classifyCountry('US'),
    );
    await signupAttribution({ userId, anonId: null, attribution, method: 'email' });
    await signupAttribution({ userId, anonId: null, attribution: ft(), method: 'email' });
    const row = await db().user.findUniqueOrThrow({ where: { id: userId } });
    expect(row.utm_campaign).toBe('ä!'.repeat(50));
    expect(row.utm_source).toBeNull();
    expect(row.referrer).toBe('https://external.test/path');
    expect(row.landing_path).toBe('/signup');
    expect(row.geo_country).toBe('US');
    await drain();
  });
  it('50 server events never include PII, click IDs, IPs or free text fields', async () => {
    for (let i = 0; i < 50; i++) {
      const userId = await newUser();
      await signupAttribution({ userId, anonId: null, attribution: ft(), method: 'email' });
    }
    await drain();
    const sample = events.filter((e) => e.event === 'signup').slice(-50);
    expect(sample).toHaveLength(50);
    for (const event of sample) {
      for (const key of ['email', 'name', '$ip', 'photo', 'token', 'prompt'])
        expect(event.properties).not.toHaveProperty(key);
      expect(JSON.stringify(event)).not.toMatch(
        /example.invalid|gclid|fbclid|token=|secret|Local QA/,
      );
    }
  });
});
