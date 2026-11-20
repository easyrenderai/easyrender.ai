import { createHmac } from 'node:crypto';
import { db } from '@easyrender/db';
import { RENDER_CREDITS } from '@easyrender/harness';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Runs against a real Postgres: set TEST_DATABASE_URL (a scratch database with the schema pushed).
// Shopify's API is faked with a small in-memory store; Replicate and storage are faked as in
// catalog.integration.test.ts. The queue, credits, encryption and links are the real code.
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

const fake = vi.hoisted(() => ({ start: vi.fn(), upload: vi.fn(), image: vi.fn() }));
vi.mock('@easyrender/harness', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@easyrender/harness')>()),
  checkPhoto: async () => ({
    ok: true,
    warnings: [],
    measures: { width: 1200, height: 900, spread: 40, sharpness: 120 },
  }),
  cutCells: async () => Array.from({ length: 9 }, () => new Uint8Array([1])),
  createReplicate: () => ({
    upload: fake.upload,
    start: fake.start,
    get: async () => ({ status: 'processing' }),
  }),
}));
vi.mock('./storage', () => ({
  getFile: async () => new Uint8Array([1, 2, 3]),
  putFile: async (path: string) => `fake:${path}`,
}));
vi.mock('./remote-image', () => ({
  fetchRemoteImage: (...args: unknown[]) => fake.image(...args),
}));

const run = describe.skipIf(!url);

const KEY = 'client-id-123';
const SECRET = 'shpss_test_secret';
const SHOP = 'my-store.myshopify.com';

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

// A shop with products; records the metafields written and the token exchanges.
function fakeShopify(products: { id: number; title: string; image: string | null }[]) {
  const written: { ownerId: string; value: string }[] = [];
  const exchanges: unknown[] = [];
  const metafields = new Map<string, string>();
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const target = String(input);
    const body = JSON.parse(String(init?.body ?? '{}'));
    if (target.endsWith('/admin/oauth/access_token')) {
      exchanges.push(body);
      return Response.json({ access_token: 'shpat_live', scope: 'read_products,write_products' });
    }
    if (
      ((init?.headers ?? {}) as Record<string, string>)['x-shopify-access-token'] !== 'shpat_live'
    ) {
      return new Response('no', { status: 401 });
    }
    if (String(body.query).includes('metafieldsSet')) {
      for (const field of body.variables.metafields) {
        written.push(field);
        metafields.set(field.ownerId, field.value);
      }
      return Response.json({ data: { metafieldsSet: { userErrors: [] } } });
    }
    return Response.json({
      data: {
        products: {
          nodes: products.map((product) => ({
            id: `gid://shopify/Product/${product.id}`,
            title: product.title,
            featuredMedia: product.image ? { image: { url: product.image } } : null,
            metafield: metafields.has(`gid://shopify/Product/${product.id}`)
              ? { value: metafields.get(`gid://shopify/Product/${product.id}`) }
              : null,
          })),
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    });
  }) as typeof fetch;
  return { impl, written, exchanges };
}

run('shopify app (real database)', () => {
  const newUser = async (credits: number) => {
    const id = `u_${Math.random().toString(36).slice(2)}`;
    await db().user.create({ data: { id, name: 'T', email: `${id}@example.com`, credits } });
    return id;
  };

  beforeEach(async () => {
    process.env.SHOPIFY_API_KEY = KEY;
    process.env.SHOPIFY_API_SECRET = SECRET;
    process.env.BETTER_AUTH_SECRET = 'test-secret-test-secret-test-secret';
    process.env.REPLICATE_API_TOKEN = 'test';
    fake.upload.mockReset().mockResolvedValue('https://replicate.test/file');
    fake.start.mockReset().mockImplementation(async () => ({ id: `pred_${Math.random()}` }));
    fake.image
      .mockReset()
      .mockResolvedValue({ bytes: new Uint8Array([1]), contentType: 'image/jpeg' });
    await db().shopifyShop.deleteMany({ where: { shop: SHOP } });
    await db().catalogItem.deleteMany({ where: { platform: 'shopify', store: SHOP } });
  });

  afterAll(async () => {
    await db().$disconnect();
  });

  const products = [
    { id: 1, title: 'Oak chair', image: 'https://cdn.shopify.com/1.jpg' },
    { id: 2, title: 'Walnut table', image: 'https://cdn.shopify.com/2.jpg' },
    { id: 3, title: 'Gift card', image: null },
  ];

  it('asks an unlinked shop to connect an account, and stores its token encrypted', async () => {
    const { shopifyOverview } = await import('./shopify-app');
    const shopify = fakeShopify(products);
    const overview = await shopifyOverview(SHOP, sessionToken(), shopify.impl);
    expect(overview).toMatchObject({ isLinked: false });
    expect((overview as { linkUrl: string }).linkUrl).toContain(
      '/shopify/connect?shop=my-store.myshopify.com&state=',
    );
    expect(shopify.exchanges).toHaveLength(1);
    const row = await db().shopifyShop.findUniqueOrThrow({ where: { shop: SHOP } });
    expect(row.accessToken).not.toContain('shpat_live');
    // A second open reuses the stored token instead of exchanging again.
    await shopifyOverview(SHOP, sessionToken(), shopify.impl);
    expect(shopify.exchanges).toHaveLength(1);
  });

  it('shows the price of a whole-catalogue run and skips products without a photo', async () => {
    const { shopifyOverview } = await import('./shopify-app');
    const { linkShop } = await import('./shopify');
    const userId = await newUser(RENDER_CREDITS * 5);
    const shopify = fakeShopify(products);
    await shopifyOverview(SHOP, sessionToken(), shopify.impl);
    await linkShop(SHOP, userId);
    const overview = await shopifyOverview(SHOP, sessionToken(), shopify.impl);
    expect(overview).toMatchObject({
      isLinked: true,
      eligible: 2,
      noPhoto: 1,
      balance: RENDER_CREDITS * 5,
      quote: { totalCredits: RENDER_CREDITS * 2, missingCredits: 0 },
    });
    // The master grid has one row per product, whether or not it can be built.
    const rows = (overview as { products: { id: string; status: string; isSelectable: boolean }[] })
      .products;
    expect(rows.map((row) => [row.id, row.status, row.isSelectable])).toEqual([
      ['1', 'missing', true],
      ['2', 'missing', true],
      ['3', 'no_photo', false],
    ]);
  });

  it('builds only the ticked products, shows their stage, and never rebuilds a ready one', async () => {
    const { shopifyOverview, shopifyGenerate } = await import('./shopify-app');
    const { linkShop } = await import('./shopify');
    const userId = await newUser(RENDER_CREDITS * 5);
    const shopify = fakeShopify(products);
    await shopifyOverview(SHOP, sessionToken(), shopify.impl);
    await linkShop(SHOP, userId);

    // The price is for the ticked product alone.
    await expect(
      shopifyGenerate(
        SHOP,
        sessionToken(),
        { approvedCredits: 0, isFirst: true, externalIds: ['2'] },
        shopify.impl,
      ),
    ).rejects.toMatchObject({ code: 'quote_changed' });
    expect(
      await shopifyGenerate(
        SHOP,
        sessionToken(),
        { approvedCredits: RENDER_CREDITS, isFirst: true, externalIds: ['2'] },
        shopify.impl,
      ),
    ).toEqual({ sent: 1, remaining: 0 });
    expect(
      (await db().catalogItem.findMany({ where: { userId } })).map((item) => item.externalId),
    ).toEqual(['2']);

    // It is now running, with its real stage, and no longer offered for building.
    const running = (await shopifyOverview(SHOP, sessionToken(), shopify.impl)) as {
      products: { id: string; status: string; stage: string | null; isSelectable: boolean }[];
    };
    expect(
      running.products.map((row) => [row.id, row.status, row.stage, row.isSelectable]),
    ).toEqual([
      ['1', 'missing', null, true],
      ['2', 'building', 'sheet', false],
      ['3', 'no_photo', null, false],
    ]);

    // Ticking it again, with product 1, only builds product 1.
    expect(
      await shopifyGenerate(
        SHOP,
        sessionToken(),
        { approvedCredits: RENDER_CREDITS, isFirst: true, externalIds: ['1', '2'] },
        shopify.impl,
      ),
    ).toEqual({ sent: 1, remaining: 0 });
    expect(await db().catalogItem.count({ where: { userId } })).toBe(2);
  });

  it('refuses a stale price, queues the products on the next click and writes finished models to the product', async () => {
    const { shopifyOverview, shopifyGenerate } = await import('./shopify-app');
    const { linkShop } = await import('./shopify');
    const userId = await newUser(RENDER_CREDITS * 5);
    const shopify = fakeShopify(products);
    await shopifyOverview(SHOP, sessionToken(), shopify.impl);
    await linkShop(SHOP, userId);

    await expect(
      shopifyGenerate(
        SHOP,
        sessionToken(),
        { approvedCredits: RENDER_CREDITS, isFirst: true },
        shopify.impl,
      ),
    ).rejects.toMatchObject({ code: 'quote_changed' });
    expect(await db().catalogItem.count({ where: { userId } })).toBe(0);

    const result = await shopifyGenerate(
      SHOP,
      sessionToken(),
      { approvedCredits: RENDER_CREDITS * 2, isFirst: true },
      shopify.impl,
    );
    expect(result).toEqual({ sent: 2, remaining: 0 });
    const items = await db().catalogItem.findMany({
      where: { userId },
      orderBy: { externalId: 'asc' },
    });
    expect(items.map((item) => [item.externalId, item.state])).toEqual([
      ['1', 'drafting'],
      ['2', 'drafting'],
    ]);

    // Nothing left to send: the products are on their way.
    expect(
      await shopifyGenerate(
        SHOP,
        sessionToken(),
        { approvedCredits: 0, isFirst: false },
        shopify.impl,
      ),
    ).toEqual({ sent: 0, remaining: 0 });

    // Product 1 finishes: the next overview puts its render id on the Shopify product.
    await db().render.update({
      where: { id: items[0]?.renderId ?? '' },
      data: { status: 'ready', glbKey: 'fake:model.glb' },
    });
    const after = await shopifyOverview(SHOP, sessionToken(), shopify.impl);
    expect(shopify.written).toEqual([
      expect.objectContaining({ ownerId: 'gid://shopify/Product/1', value: items[0]?.renderId }),
    ]);
    expect(after).toMatchObject({ isLinked: true, summary: { ready: 1, drafting: 1 } });
    // Written once: a later overview does not rewrite it.
    await shopifyOverview(SHOP, sessionToken(), shopify.impl);
    expect(shopify.written).toHaveLength(1);
  });

  it('forgets the shop and its products when the app is uninstalled', async () => {
    const { shopifyOverview } = await import('./shopify-app');
    const { linkShop, removeShop } = await import('./shopify');
    const userId = await newUser(RENDER_CREDITS);
    const shopify = fakeShopify(products);
    await shopifyOverview(SHOP, sessionToken(), shopify.impl);
    await linkShop(SHOP, userId);
    await db().catalogItem.create({
      data: {
        userId,
        platform: 'shopify',
        store: SHOP,
        externalId: '1',
        title: 'x',
        imageUrl: 'https://x/1.jpg',
      },
    });
    await removeShop(SHOP);
    expect(await db().shopifyShop.count({ where: { shop: SHOP } })).toBe(0);
    expect(await db().catalogItem.count({ where: { platform: 'shopify', store: SHOP } })).toBe(0);
  });
});
