import { type CatalogItem, db, Prisma } from '@easyrender/db';
import {
  MAX_SIDE_CM,
  MIN_SIDE_CM,
  RENDER_CREDITS,
  type RealSize,
  sanitizeRealSize,
} from '@easyrender/harness';
import { actorForApiKey, assertActorScope } from './api-access';
import { config } from './config';
import { getBalance } from './credits';
import { AppError } from './errors';
import { fetchRemoteImage } from './remote-image';
import { advance, createDraft, startBuild } from './renders';
import { reportError } from './report';

// Turns a store's catalogue into 3D models. A plugin (Shopify, WooCommerce, ...) sends products;
// the server walks each one from photo to finished model and spends the owner's credits for it.
// Plugins only send products, poll `listCatalog` and show the links of the finished ones.

export const CATALOG_PLATFORMS = ['shopify', 'woocommerce', 'prestashop', 'other'] as const;
export type CatalogPlatform = (typeof CATALOG_PLATFORMS)[number];

export const CATALOG_STATES = [
  'queued',
  'drafting',
  'building',
  'ready',
  'needs_credits',
  'needs_info',
  'failed',
] as const;
export type CatalogState = (typeof CATALOG_STATES)[number];

export const MAX_CATALOG_BATCH = 100;
// Drafts and builds running at once per account. Replicate can take more; this keeps one
// big catalogue from using every slot and keeps a tick inside one serverless request.
const MAX_CONCURRENT = 8;
const MAX_ADVANCE_PER_TICK = 20;

export type CatalogInput = {
  externalId: string;
  title: string;
  imageUrl: string;
  note?: string;
  // The product's size in the store. It becomes the real size of the model in AR.
  sizeCm?: RealSize;
};

// A store's dimensions are whatever the merchant typed: keep the sides that make sense and drop
// the rest, so a blank or zero field never fails a whole batch of products.
function cleanSize(value: unknown): RealSize | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const sides: Record<string, number> = {};
  for (const key of ['widthCm', 'depthCm', 'heightCm']) {
    const side = record[key];
    if (typeof side === 'number' && side >= MIN_SIDE_CM && side <= MAX_SIDE_CM) sides[key] = side;
  }
  return sanitizeRealSize(sides) ?? undefined;
}

export type CatalogScope = { userId: string; platform: CatalogPlatform; store: string };

export type CatalogItemView = {
  externalId: string;
  title: string;
  state: CatalogState;
  error: string | null;
  renderId: string | null;
  // Set once the model is ready: the phone AR page the store links and turns into a QR code.
  arUrl: string | null;
  qrUrl: string | null;
  modelUrl: string | null;
};

export type CatalogSummary = Record<CatalogState, number> & { total: number };

export function isCatalogPlatform(value: unknown): value is CatalogPlatform {
  return typeof value === 'string' && (CATALOG_PLATFORMS as readonly string[]).includes(value);
}

export function normalizeStore(value: unknown): string {
  const store = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!store || store.length > 255) throw new AppError('Send the store domain', 400, 'bad_store');
  return store;
}

export function parseCatalogItems(value: unknown): CatalogInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError('Send at least one product', 400, 'bad_items');
  }
  if (value.length > MAX_CATALOG_BATCH) {
    throw new AppError(`Send at most ${MAX_CATALOG_BATCH} products per request`, 400, 'bad_items');
  }
  const seen = new Set<string>();
  return value.map((raw: unknown) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    const externalId = typeof item.externalId === 'string' ? item.externalId.trim() : '';
    const title = typeof item.title === 'string' ? item.title.trim().slice(0, 120) : '';
    const imageUrl = typeof item.imageUrl === 'string' ? item.imageUrl.trim() : '';
    if (!externalId || externalId.length > 128) {
      throw new AppError(
        'Every product needs an externalId (128 characters at most)',
        400,
        'bad_items',
      );
    }
    if (seen.has(externalId)) {
      throw new AppError(`Product ${externalId} is listed twice`, 400, 'bad_items');
    }
    seen.add(externalId);
    if (!imageUrl.startsWith('https://') || imageUrl.length > 2048) {
      throw new AppError(`Product ${externalId} needs an https imageUrl`, 400, 'bad_items');
    }
    const note = typeof item.note === 'string' ? item.note.trim().slice(0, 500) : '';
    const sizeCm = cleanSize(item.sizeCm);
    return {
      externalId,
      title: title || externalId,
      imageUrl,
      ...(note ? { note } : {}),
      ...(sizeCm ? { sizeCm } : {}),
    };
  });
}

export type CatalogQuote = {
  items: number;
  creditsPerModel: number;
  totalCredits: number;
  balance: number;
  // 0 when the balance covers the whole run.
  missingCredits: number;
};

export async function quoteCatalog(userId: string, items: number): Promise<CatalogQuote> {
  const balance = await getBalance(userId);
  const totalCredits = items * RENDER_CREDITS;
  return {
    items,
    creditsPerModel: RENDER_CREDITS,
    totalCredits,
    balance,
    missingCredits: Math.max(0, totalCredits - balance),
  };
}

function view(item: CatalogItem): CatalogItemView {
  const base = config.appUrl();
  const isReady = item.state === 'ready' && item.renderId;
  return {
    externalId: item.externalId,
    title: item.title,
    state: item.state as CatalogState,
    error: item.error,
    renderId: item.renderId,
    arUrl: isReady ? `${base}/ar/${item.renderId}` : null,
    qrUrl: isReady ? `${base}/api/renders/${item.renderId}/qr` : null,
    modelUrl: isReady ? `${base}/api/renders/${item.renderId}/model` : null,
  };
}

// Queues the products that still need a model: new ones, and ones that failed or lacked info.
// Ready and in-flight products are left alone. `maxCredits` is the total the owner saw and
// approved, so a quote that went stale (more products than they confirmed) is refused.
export async function submitCatalog(
  scope: CatalogScope,
  items: CatalogInput[],
  maxCredits: number,
  apiKeyId?: string,
): Promise<{ queued: number; skipped: number; quote: CatalogQuote }> {
  const authorization = await actorForApiKey(scope.userId, apiKeyId);
  for (const permission of ['write', 'spend', 'share'] as const)
    assertActorScope(authorization, permission);
  const existing = await db().catalogItem.findMany({
    where: { ...scope, externalId: { in: items.map((item) => item.externalId) } },
    select: { externalId: true, state: true },
  });
  const state = new Map(existing.map((item) => [item.externalId, item.state]));
  const todo = items.filter((item) => {
    const current = state.get(item.externalId);
    return !current || current === 'failed' || current === 'needs_info';
  });
  const quote = await quoteCatalog(scope.userId, todo.length);
  if (quote.totalCredits > maxCredits) {
    throw new AppError(
      `This run costs ${quote.totalCredits} credits, more than the ${maxCredits} you approved`,
      409,
      'quote_changed',
    );
  }
  const queued = await db().$transaction(async (tx) => {
    let accepted = 0;
    // Stable row order avoids deadlocks when batches overlap in a different caller order.
    for (const item of [...todo].sort((a, b) => a.externalId.localeCompare(b.externalId))) {
      const values = {
        apiKeyId: apiKeyId ?? null,
        title: item.title,
        imageUrl: item.imageUrl,
        note: item.note ?? null,
        sizeCm: item.sizeCm ?? Prisma.DbNull,
      };
      // A concurrent submission may already have queued or started this externalId since
      // the quote read. Never overwrite that generation or its retained authorization.
      const inserted = await tx.catalogItem.createMany({
        data: { ...scope, ...values, externalId: item.externalId },
        skipDuplicates: true,
      });
      if (inserted.count) {
        accepted += inserted.count;
        continue;
      }
      const retried = await tx.catalogItem.updateMany({
        where: { ...scope, externalId: item.externalId, state: { in: ['failed', 'needs_info'] } },
        data: { ...values, state: 'queued', renderId: null, error: null },
      });
      accepted += retried.count;
    }
    return accepted;
  });
  await tickCatalog(scope);
  const totalCredits = queued * RENDER_CREDITS;
  return {
    queued,
    skipped: items.length - queued,
    quote: {
      ...quote,
      items: queued,
      totalCredits,
      missingCredits: Math.max(0, totalCredits - quote.balance),
    },
  };
}

const IN_FLIGHT_STATES = ['drafting', 'building', 'needs_credits'];

async function setState(item: CatalogItem, state: CatalogState, error: string | null = null) {
  if (item.state === state && item.error === error) return;
  await db().catalogItem.update({ where: { id: item.id }, data: { state, error } });
}

// Moves one in-flight product forward: reads its render, builds the 3D model once the draft is
// ready, and records the outcome.
async function advanceItem(item: CatalogItem, canPay: boolean) {
  if (!item.renderId) return setState(item, 'failed', 'Generation did not start');
  if (item.state === 'needs_credits' && !canPay) return;
  try {
    let render = await advance(item.renderId);
    if (!render) return await setState(item, 'failed', 'The render was removed');
    if (render.status === 'preview_ready') {
      render = await startBuild(render.id, await actorForApiKey(item.userId, item.apiKeyId));
    }
    if (render.status === 'ready') return await setState(item, 'ready');
    if (render.status === 'failed') {
      return await setState(item, 'failed', 'Generation failed. Credits, if any, were refunded.');
    }
    return await setState(item, render.status === 'rendering' ? 'building' : 'drafting');
  } catch (error) {
    if (
      error instanceof AppError &&
      ['insufficient_scope', 'key_budget_exceeded'].includes(error.code)
    ) {
      return await setState(item, 'needs_info', error.message);
    }
    if (error instanceof AppError && error.code === 'insufficient_credits') {
      return await setState(item, 'needs_credits', 'Add credits to finish this model');
    }
    reportError(error, { stage: 'catalog-advance', renderId: item.renderId });
    // The render is paid or running elsewhere; try again on the next tick instead of failing it.
  }
}

async function startItem(item: CatalogItem): Promise<void> {
  try {
    const actor = await actorForApiKey(item.userId, item.apiKeyId);
    for (const permission of ['write', 'spend', 'share'] as const)
      assertActorScope(actor, permission);
    const image = await fetchRemoteImage(item.imageUrl);
    const render = await createDraft({
      actor,
      ...image,
      prompt: item.note,
      name: item.title,
      source: 'api',
      isLinkShared: true,
    });
    // The product's size in the store is the model's real size, until its owner changes it.
    const size = sanitizeRealSize(item.sizeCm);
    if (size) await db().render.update({ where: { id: render.id }, data: { sizeCm: size } });
    await db().catalogItem.update({
      where: { id: item.id },
      data: { renderId: render.id, state: 'drafting', error: null },
    });
  } catch (error) {
    if (error instanceof AppError && error.code === 'preview_limit') {
      // Out of previews for today: wait in the queue, the next tick tries again.
      await setState(item, 'queued');
      return;
    }
    const message = error instanceof AppError ? error.message : 'Could not start this product';
    if (!(error instanceof AppError)) reportError(error, { stage: 'catalog-start' });
    // A caller problem (bad photo, unreachable image) needs the owner; anything else is a failure.
    const isCallerError = error instanceof AppError && error.status < 500;
    await setState(item, isCallerError ? 'needs_info' : 'failed', message);
  }
}

// Does the next bit of work for one store: finishes what is running, then starts queued products
// while the balance can pay for them. Safe to call from polling and webhooks at the same time:
// a product is claimed before it starts.
export async function tickCatalog(scope: CatalogScope): Promise<void> {
  const { userId } = scope;
  const running = await db().catalogItem.findMany({
    where: { ...scope, state: { in: IN_FLIGHT_STATES } },
    orderBy: { updatedAt: 'asc' },
    take: MAX_ADVANCE_PER_TICK,
  });
  const canPay = (await getBalance(userId)) >= RENDER_CREDITS;
  await Promise.all(running.map((item) => advanceItem(item, canPay)));

  const [states, balance] = await Promise.all([
    db().catalogItem.groupBy({
      by: ['state'],
      where: { userId, state: { in: IN_FLIGHT_STATES } },
      _count: { _all: true },
    }),
    getBalance(userId),
  ]);
  const count = (state: string) => states.find((row) => row.state === state)?._count._all ?? 0;
  // A draft that is not built yet still has its 3D build to pay for, so it reserves credits.
  const reserved = (count('drafting') + count('needs_credits')) * RENDER_CREDITS;
  const affordable = Math.floor((balance - reserved) / RENDER_CREDITS);
  const free = MAX_CONCURRENT - count('drafting') - count('building');
  const slots = Math.min(affordable, free);
  if (slots <= 0) return;

  const queued = await db().catalogItem.findMany({
    where: { ...scope, state: 'queued' },
    orderBy: { createdAt: 'asc' },
    take: slots,
  });
  const claimed: CatalogItem[] = [];
  for (const item of queued) {
    const { count: won } = await db().catalogItem.updateMany({
      where: { id: item.id, state: 'queued' },
      data: { state: 'drafting' },
    });
    if (won > 0) claimed.push(item);
  }
  await Promise.all(claimed.map(startItem));
}

// A render moved (Replicate called back): carry its product, and the rest of its store, forward.
export async function tickForRender(renderId: string): Promise<void> {
  const item = await db().catalogItem.findFirst({ where: { renderId } });
  if (!item || !isCatalogPlatform(item.platform)) return;
  await tickCatalog({ userId: item.userId, platform: item.platform, store: item.store });
}

export async function listCatalog(
  scope: CatalogScope,
): Promise<{ items: CatalogItemView[]; summary: CatalogSummary; balance: number }> {
  await tickCatalog(scope);
  const [items, balance] = await Promise.all([
    db().catalogItem.findMany({ where: scope, orderBy: { createdAt: 'asc' }, take: 5000 }),
    getBalance(scope.userId),
  ]);
  const summary = Object.fromEntries(CATALOG_STATES.map((state) => [state, 0])) as CatalogSummary;
  summary.total = items.length;
  for (const item of items) summary[item.state as CatalogState] += 1;
  return { items: items.map(view), summary, balance };
}

// Forgets a store's products, for example when the plugin is uninstalled. Renders are kept.
export async function removeCatalog(scope: CatalogScope): Promise<void> {
  await db().catalogItem.deleteMany({ where: scope });
}
