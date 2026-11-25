import { createHmac } from 'node:crypto';
import { db } from '@easyrender/db';
import { PAYG, paygPriceCents } from '@easyrender/harness';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

// Runs against a real Postgres: set TEST_DATABASE_URL (a scratch database with the schema pushed).
// Shopify's API is faked with a small in-memory billing store; credits, the ledger and the purchase
// rows are the real code.
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

const run = describe.skipIf(!url);

const KEY = 'client-id-123';
const SECRET = 'shpss_test_secret';
const SHOP = 'billing-store.myshopify.com';

function sessionToken() {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const body = `${part({ alg: 'HS256' })}.${part({
    iss: `https://${SHOP}/admin`,
    dest: `https://${SHOP}`,
    aud: KEY,
    exp: Math.floor(Date.now() / 1000) + 60,
  })}`;
  return `${body}.${createHmac('sha256', SECRET).update(body).digest('base64url')}`;
}

// A shop whose charges the test moves between statuses, the way the merchant would in Shopify.
function fakeShopify({ isDevelopmentStore = false } = {}) {
  const charges = new Map<string, { status: string; test: boolean; amount: string }>();
  const created: Record<string, unknown>[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const target = String(input);
    const body = JSON.parse(String(init?.body ?? '{}'));
    if (target.endsWith('/admin/oauth/access_token')) {
      return Response.json({ access_token: 'shpat_live', scope: 'read_products' });
    }
    const query = String(body.query);
    if (query.includes('partnerDevelopment')) {
      return Response.json({
        data: { shop: { plan: { partnerDevelopment: isDevelopmentStore } } },
      });
    }
    if (query.includes('appPurchaseOneTimeCreate')) {
      created.push(body.variables);
      // Shopify's ids are unique across shops; the ledger key is built from this one.
      const id = `gid://shopify/AppPurchaseOneTime/${Math.random().toString(36).slice(2)}`;
      charges.set(id, {
        status: 'PENDING',
        test: body.variables.test,
        amount: body.variables.price.amount,
      });
      return Response.json({
        data: {
          appPurchaseOneTimeCreate: {
            appPurchaseOneTime: { id },
            confirmationUrl: `https://${SHOP}/admin/charges/${charges.size}/confirm`,
            userErrors: [],
          },
        },
      });
    }
    const charge = charges.get(body.variables.id);
    return Response.json({
      data: {
        node: charge
          ? {
              id: body.variables.id,
              status: charge.status,
              test: charge.test,
              price: { amount: charge.amount, currencyCode: 'USD' },
            }
          : null,
      },
    });
  }) as typeof fetch;
  return { impl, charges, created };
}

function chargeOf(shopify: ReturnType<typeof fakeShopify>, chargeId: string) {
  const charge = shopify.charges.get(chargeId);
  if (!charge) throw new Error(`no charge ${chargeId}`);
  return charge;
}

run('shopify billing (real database)', () => {
  const pack = PAYG.presets[0] as number;
  const newUser = async (credits = 0) => {
    const id = `u_${Math.random().toString(36).slice(2)}`;
    await db().user.create({ data: { id, name: 'T', email: `${id}@example.com`, credits } });
    return id;
  };
  const balance = async (userId: string) =>
    (await db().user.findUniqueOrThrow({ where: { id: userId } })).credits;

  beforeEach(async () => {
    process.env.SHOPIFY_API_KEY = KEY;
    process.env.SHOPIFY_API_SECRET = SECRET;
    process.env.BETTER_AUTH_SECRET = 'test-secret-test-secret-test-secret';
    await db().shopifyPurchase.deleteMany({ where: { shop: SHOP } });
    await db().shopifyShop.deleteMany({ where: { shop: SHOP } });
  });

  afterAll(async () => {
    await db().$disconnect();
  });

  async function openShop(shopify: ReturnType<typeof fakeShopify>, userId?: string) {
    const { ensureShop, linkShop } = await import('./shopify');
    await ensureShop(SHOP, sessionToken(), shopify.impl);
    if (userId) await linkShop(SHOP, userId);
  }

  it('charges the pay-as-you-go price of a pack and credits it once Shopify says it is active', async () => {
    const { createShopifyPurchase, settleShopifyPurchase } = await import('./shopify-billing');
    const userId = await newUser(10);
    const shopify = fakeShopify();
    await openShop(shopify, userId);

    const { confirmationUrl } = await createShopifyPurchase(
      SHOP,
      sessionToken(),
      { credits: pack },
      shopify.impl,
    );
    expect(confirmationUrl).toContain(`https://${SHOP}/admin/charges`);
    expect(shopify.created[0]).toMatchObject({
      price: { amount: (paygPriceCents(pack) / 100).toFixed(2), currencyCode: 'USD' },
      test: false,
    });

    // Not approved yet: nothing is credited.
    const row = await db().shopifyPurchase.findFirstOrThrow({ where: { shop: SHOP } });
    expect(await settleShopifyPurchase(row.chargeId, shopify.impl)).toBe('pending');
    expect(await balance(userId)).toBe(10);

    // Approved and invoiced: credited, and settling again (webhook plus page) credits nothing more.
    chargeOf(shopify, row.chargeId).status = 'ACTIVE';
    expect(await settleShopifyPurchase(row.chargeId, shopify.impl)).toBe('active');
    expect(await settleShopifyPurchase(row.chargeId, shopify.impl)).toBe('active');
    expect(await balance(userId)).toBe(10 + pack);
    const ledger = await db().creditLedger.findMany({
      where: { userId, reason: 'shopify_purchase' },
    });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      delta: pack,
      idempotencyKey: `shopify:purchase:${row.chargeId}`,
    });
    // A Shopify pack is not a Stripe purchase: no Purchase row, so nothing is queued for Stripe,
    // PostHog or Google purchase delivery, which all start from a Purchase.
    expect(await db().purchase.count({ where: { userId } })).toBe(0);
  });

  it('credits nothing for a declined or expired charge', async () => {
    const { createShopifyPurchase, settleShopifyPurchase } = await import('./shopify-billing');
    const userId = await newUser();
    const shopify = fakeShopify();
    await openShop(shopify, userId);
    await createShopifyPurchase(SHOP, sessionToken(), { credits: pack }, shopify.impl);
    const row = await db().shopifyPurchase.findFirstOrThrow({ where: { shop: SHOP } });
    chargeOf(shopify, row.chargeId).status = 'DECLINED';
    expect(await settleShopifyPurchase(row.chargeId, shopify.impl)).toBe('declined');
    // A later change on Shopify's side does not bring a closed purchase back.
    chargeOf(shopify, row.chargeId).status = 'ACTIVE';
    expect(await settleShopifyPurchase(row.chargeId, shopify.impl)).toBe('declined');
    expect(await balance(userId)).toBe(0);
  });

  it('refuses a pack that is not for sale and a shop with no easyrender account', async () => {
    const { createShopifyPurchase } = await import('./shopify-billing');
    const shopify = fakeShopify();
    await openShop(shopify);
    await expect(
      createShopifyPurchase(SHOP, sessionToken(), { credits: pack }, shopify.impl),
    ).rejects.toMatchObject({ code: 'not_linked' });
    await openShop(shopify, await newUser());
    await expect(
      createShopifyPurchase(SHOP, sessionToken(), { credits: pack + 1 }, shopify.impl),
    ).rejects.toMatchObject({ code: 'bad_pack' });
    expect(shopify.created).toHaveLength(0);
  });

  it('does not credit a charge whose price is not the pack price', async () => {
    const { createShopifyPurchase, settleShopifyPurchase } = await import('./shopify-billing');
    const userId = await newUser();
    const shopify = fakeShopify();
    await openShop(shopify, userId);
    await createShopifyPurchase(SHOP, sessionToken(), { credits: pack }, shopify.impl);
    const row = await db().shopifyPurchase.findFirstOrThrow({ where: { shop: SHOP } });
    Object.assign(chargeOf(shopify, row.chargeId), { status: 'ACTIVE', amount: '0.01' });
    await expect(settleShopifyPurchase(row.chargeId, shopify.impl)).rejects.toMatchObject({
      code: 'shopify_billing',
    });
    expect(await balance(userId)).toBe(0);
  });

  it('credits a development-store test charge only once per account', async () => {
    const { createShopifyPurchase, settleShopifyPurchase } = await import('./shopify-billing');
    const userId = await newUser();
    const shopify = fakeShopify({ isDevelopmentStore: true });
    await openShop(shopify, userId);
    for (let attempt = 0; attempt < 2; attempt++) {
      await createShopifyPurchase(SHOP, sessionToken(), { credits: pack }, shopify.impl);
    }
    expect(shopify.created.every((variables) => variables.test === true)).toBe(true);
    const rows = await db().shopifyPurchase.findMany({
      where: { shop: SHOP },
      orderBy: { createdAt: 'asc' },
    });
    for (const row of rows) {
      chargeOf(shopify, row.chargeId).status = 'ACTIVE';
      expect(await settleShopifyPurchase(row.chargeId, shopify.impl)).toBe('active');
    }
    expect(await balance(userId)).toBe(pack);
    const after = await db().shopifyPurchase.findMany({ where: { shop: SHOP } });
    expect(after.filter((row) => row.creditedAt).length).toBe(1);
  });

  it('the page credits a pack the merchant just approved, before it reads the balance', async () => {
    const { createShopifyPurchase } = await import('./shopify-billing');
    const { shopifyOverview } = await import('./shopify-app');
    const userId = await newUser(5);
    const shopify = fakeShopify();
    // The overview reads the catalogue too: give it an empty product list.
    const billing = shopify.impl;
    const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(JSON.parse(String(init?.body ?? '{}')).query).includes('products(')) {
        return Response.json({
          data: { products: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } },
        });
      }
      return billing(input, init);
    }) as typeof fetch;
    await openShop(shopify, userId);
    await createShopifyPurchase(SHOP, sessionToken(), { credits: pack }, impl);
    const row = await db().shopifyPurchase.findFirstOrThrow({ where: { shop: SHOP } });

    const waiting = await shopifyOverview(SHOP, sessionToken(), impl);
    expect(waiting).toMatchObject({ isLinked: true, balance: 5, hasPendingPurchase: true });
    chargeOf(shopify, row.chargeId).status = 'ACTIVE';
    const done = await shopifyOverview(SHOP, sessionToken(), impl);
    expect(done).toMatchObject({ balance: 5 + pack, hasPendingPurchase: false });
    expect((done as { packs: unknown[] }).packs).toHaveLength(PAYG.presets.length);
  });
});
