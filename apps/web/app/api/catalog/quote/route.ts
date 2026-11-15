import { AppError, MAX_CATALOG_BATCH, quoteCatalog } from '@easyrender/core';
import { NextResponse } from 'next/server';
import { resolveActor } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

// Query: items (how many products). What a run costs and whether the balance covers it, so the
// plugin can show the price on its button before anything is spent.
export const GET = (request: Request) =>
  apiHandle(request, async () => {
    const actor = await resolveActor(request.headers);
    if (!actor.userId) throw new AppError('Send your easyrender API key', 401, 'unauthorized');
    const items = Number(new URL(request.url).searchParams.get('items'));
    if (!Number.isInteger(items) || items < 1 || items > 100_000) {
      throw new AppError('Send items: how many products', 400, 'bad_items');
    }
    return NextResponse.json({
      ...(await quoteCatalog(actor.userId, items)),
      maxPerRequest: MAX_CATALOG_BATCH,
    });
  });

export const OPTIONS = apiOptions;
