import { db } from '@easyrender/db';
import {
  type CatalogInput,
  type CatalogQuote,
  type CatalogScope,
  type CatalogSummary,
  listCatalog,
  MAX_CATALOG_BATCH,
  quoteCatalog,
  submitCatalog,
} from './catalog';
import { config } from './config';
import { AppError } from './errors';
import {
  decryptToken,
  ensureShop,
  listShopProducts,
  type ShopifyProduct,
  signLinkState,
  writeRenderMetafields,
} from './shopify';
import { type ShopifyPack, settlePendingPurchases, shopifyPacks } from './shopify-billing';

// What the embedded Shopify page does, step by step. Every call is for one shop, proven by a
// session token (see ./shopify). The shop's products are read from Shopify each time; the 3D work
// is the shared catalogue queue, with platform "shopify" and the shop's domain as the store.

type Fetch = typeof fetch;

// Where a product is in the pipeline, as the merchant sees it. `missing` has no model and nothing
// running; `no_photo` cannot be built until the product gets a photo.
export type ShopifyProductStatus =
  | 'missing'
  | 'no_photo'
  | 'queued'
  | 'building'
  | 'ready'
  | 'needs_credits'
  | 'needs_info'
  | 'failed';

// The real step a running product is on, read from its render (never a made-up percentage).
export type ShopifyProductStage = 'waiting' | 'sheet' | 'final_sheet' | 'model' | 'starting_build';

export type ShopifyProductRow = {
  id: string;
  title: string;
  // A small thumbnail of the product photo.
  imageUrl: string | null;
  status: ShopifyProductStatus;
  stage: ShopifyProductStage | null;
  error: string | null;
  // True when "generate" would build this product: missing, or failed and worth another try.
  isSelectable: boolean;
};

export type ShopifyOverview =
  | { isLinked: false; linkUrl: string }
  | {
      isLinked: true;
      // Products that still need a model and have a photo, what that costs and the owner's balance.
      eligible: number;
      noPhoto: number;
      quote: CatalogQuote;
      summary: CatalogSummary;
      balance: number;
      // The credit packs sold through Shopify billing, and whether one is waiting for Shopify.
      packs: ShopifyPack[];
      hasPendingPurchase: boolean;
      // One row per active product: the master grid.
      products: ShopifyProductRow[];
    };

// A product is done, or on its way, in these states; failed and needs_info are retried.
const SETTLED = new Set(['ready', 'queued', 'drafting', 'building', 'needs_credits']);

async function open(shop: string, sessionToken: string, fetchImpl: Fetch) {
  const row = await ensureShop(shop, sessionToken, fetchImpl);
  return { row, accessToken: decryptToken(row.accessToken) };
}

async function plan(scope: CatalogScope, products: ShopifyProduct[], only?: ReadonlySet<string>) {
  const states = new Map(
    (
      await db().catalogItem.findMany({
        where: scope,
        select: { externalId: true, state: true },
      })
    ).map((item) => [item.externalId, item.state]),
  );
  const items: CatalogInput[] = [];
  let noPhoto = 0;
  for (const product of products) {
    if (only && !only.has(product.id)) continue;
    const state = states.get(product.id);
    if (product.renderId || (state && SETTLED.has(state))) continue;
    if (!product.imageUrl) noPhoto += 1;
    else items.push({ externalId: product.id, title: product.title, imageUrl: product.imageUrl });
  }
  return { items, noPhoto };
}

// Shopify's CDN resizes an image with ?width=, so the grid loads small files.
function thumbnail(url: string | null): string | null {
  if (!url) return null;
  try {
    const resized = new URL(url);
    resized.searchParams.set('width', '120');
    return resized.toString();
  } catch {
    return null;
  }
}

async function stagesOf(
  items: { externalId: string; renderId: string | null; state: string }[],
): Promise<Map<string, ShopifyProductStage>> {
  const running = items.filter((item) => ['drafting', 'building'].includes(item.state));
  const renders = await db().render.findMany({
    where: { id: { in: running.flatMap((item) => (item.renderId ? [item.renderId] : [])) } },
    select: { id: true, status: true, buildPredictionId: true },
  });
  const byRender = new Map(renders.map((render) => [render.id, render]));
  const stages = new Map<string, ShopifyProductStage>();
  for (const item of running) {
    const render = item.renderId ? byRender.get(item.renderId) : undefined;
    let stage: ShopifyProductStage = 'sheet';
    if (render?.status === 'preview_ready') stage = 'starting_build';
    else if (render?.status === 'rendering') {
      stage = render.buildPredictionId ? 'model' : 'final_sheet';
    }
    stages.set(item.externalId, stage);
  }
  return stages;
}

export function buildProductRows(
  products: ShopifyProduct[],
  items: { externalId: string; renderId: string | null; state: string; error: string | null }[],
  selectable: ReadonlySet<string>,
  stages: ReadonlyMap<string, ShopifyProductStage>,
): ShopifyProductRow[] {
  const byId = new Map(items.map((item) => [item.externalId, item]));
  return products.map((product) => {
    const item = byId.get(product.id);
    let status: ShopifyProductStatus;
    if (product.renderId || item?.state === 'ready') status = 'ready';
    else if (item?.state === 'queued') status = 'queued';
    else if (item?.state === 'drafting' || item?.state === 'building') status = 'building';
    else if (item?.state === 'needs_credits') status = 'needs_credits';
    else if (item?.state === 'needs_info') status = 'needs_info';
    else if (item?.state === 'failed') status = 'failed';
    else status = product.imageUrl ? 'missing' : 'no_photo';
    // A product without a photo cannot be retried, whatever its last state was.
    if (!product.imageUrl && status !== 'ready') status = 'no_photo';
    const stage =
      status === 'queued'
        ? 'waiting'
        : status === 'building'
          ? (stages.get(product.id) ?? 'sheet')
          : null;
    return {
      id: product.id,
      title: product.title,
      imageUrl: thumbnail(product.imageUrl),
      status,
      stage,
      error: status === 'ready' ? null : (item?.error ?? null),
      isSelectable: selectable.has(product.id),
    };
  });
}

export async function shopifyOverview(
  shop: string,
  sessionToken: string,
  fetchImpl: Fetch = fetch,
): Promise<ShopifyOverview> {
  const { row, accessToken } = await open(shop, sessionToken, fetchImpl);
  if (!row.userId) {
    return {
      isLinked: false,
      linkUrl: `${config.appUrl()}/shopify/connect?${new URLSearchParams({ shop, state: signLinkState(shop) })}`,
    };
  }
  const scope: CatalogScope = { userId: row.userId, platform: 'shopify', store: shop };
  // A pack the merchant just approved in Shopify is credited before the balance is read.
  const waitingPurchases = await settlePendingPurchases(shop, fetchImpl);
  const [products, catalog] = await Promise.all([
    listShopProducts(shop, accessToken, fetchImpl),
    // Reading the catalogue also moves its queue forward.
    listCatalog(scope),
  ]);

  // Finished models go onto their product, where the theme block reads them.
  const byId = new Map(products.map((product) => [product.id, product]));
  const finished = catalog.items.flatMap((item) => {
    const product = byId.get(item.externalId);
    return product && item.renderId && item.state === 'ready' && product.renderId !== item.renderId
      ? [{ gid: product.gid, renderId: item.renderId }]
      : [];
  });
  if (finished.length > 0) await writeRenderMetafields(shop, accessToken, finished, fetchImpl);

  const { items, noPhoto } = await plan(scope, products);
  return {
    isLinked: true,
    eligible: items.length,
    noPhoto,
    quote: await quoteCatalog(row.userId, items.length),
    summary: catalog.summary,
    balance: catalog.balance,
    packs: shopifyPacks(),
    hasPendingPurchase: waitingPurchases > 0,
    products: buildProductRows(
      products,
      catalog.items,
      new Set(items.map((item) => item.externalId)),
      await stagesOf(catalog.items),
    ),
  };
}

// Queues the next batch of products. The page calls it until `remaining` is 0, passing the credits
// the merchant saw on the button; a price that went up since stops the run before anything is queued.
// With `externalIds` only those products are considered, so ready and running ones are never
// rebuilt: a product that has a model or is on its way is skipped even when it is listed.
export async function shopifyGenerate(
  shop: string,
  sessionToken: string,
  input: { approvedCredits: number; isFirst: boolean; externalIds?: string[] },
  fetchImpl: Fetch = fetch,
): Promise<{ sent: number; remaining: number }> {
  const { row, accessToken } = await open(shop, sessionToken, fetchImpl);
  if (!row.userId) throw new AppError('Connect an easyrender account first', 409, 'not_linked');
  const scope: CatalogScope = { userId: row.userId, platform: 'shopify', store: shop };
  const { items } = await plan(
    scope,
    await listShopProducts(shop, accessToken, fetchImpl),
    input.externalIds ? new Set(input.externalIds) : undefined,
  );
  if (items.length === 0) return { sent: 0, remaining: 0 };

  const quote = await quoteCatalog(row.userId, items.length);
  if (input.isFirst && quote.totalCredits > input.approvedCredits) {
    throw new AppError(
      'The price changed. Reload the page and check it again.',
      409,
      'quote_changed',
    );
  }
  const batch = items.slice(0, MAX_CATALOG_BATCH);
  const { queued } = await submitCatalog(scope, batch, batch.length * quote.creditsPerModel);
  return { sent: queued, remaining: items.length - batch.length };
}
