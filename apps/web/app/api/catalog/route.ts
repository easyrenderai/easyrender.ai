import {
  AppError,
  assertActorScope,
  isCatalogPlatform,
  listCatalog,
  normalizeStore,
  parseCatalogItems,
  removeCatalog,
  submitCatalog,
} from '@easyrender/core';
import { NextResponse } from 'next/server';
import { resolveActor } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

export const maxDuration = 60;

async function scopeOf(request: Request, source: URLSearchParams | Record<string, unknown>) {
  const actor = await resolveActor(request.headers, request.method === 'GET' ? 'read' : 'write');
  if (!actor.userId) throw new AppError('Send your easyrender API key', 401, 'unauthorized');
  const get = (key: string) => (source instanceof URLSearchParams ? source.get(key) : source[key]);
  const platform = get('platform');
  if (!isCatalogPlatform(platform)) throw new AppError('Unknown platform', 400, 'bad_platform');
  return { actor, scope: { userId: actor.userId, platform, store: normalizeStore(get('store')) } };
}

// A store's products and where each one is: queued, drafting, building, ready, needs_credits,
// needs_info or failed. Calling it also moves the queue forward, so a plugin polls this.
export const GET = (request: Request) =>
  apiHandle(request, async () => {
    const { scope } = await scopeOf(request, new URL(request.url).searchParams);
    return NextResponse.json(await listCatalog(scope), {
      headers: { 'cache-control': 'no-store' },
    });
  });

// Body: { platform, store, maxCredits, items: [{ externalId, title, imageUrl, note? }] }.
// Queues the products that need a model. `maxCredits` is the total the owner approved (see
// /api/catalog/quote); a run that would cost more is refused.
export const POST = (request: Request) =>
  apiHandle(request, async () => {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') throw new AppError('Send a JSON body', 400, 'bad_body');
    const { scope, actor } = await scopeOf(request, body);
    if (typeof body.maxCredits !== 'number' || !Number.isFinite(body.maxCredits)) {
      throw new AppError('Send maxCredits: the total credits the owner approved', 400, 'bad_body');
    }
    assertActorScope(actor, 'spend');
    const result = await submitCatalog(
      scope,
      parseCatalogItems(body.items),
      body.maxCredits,
      actor.apiKeyId,
    );
    return NextResponse.json(result, { status: 202 });
  });

// Query: platform, store. Forgets the store's products (the plugin was uninstalled).
export const DELETE = (request: Request) =>
  apiHandle(request, async () => {
    const { scope } = await scopeOf(request, new URL(request.url).searchParams);
    await removeCatalog(scope);
    return new NextResponse(null, { status: 204 });
  });

export const OPTIONS = apiOptions;
