import {
  AppError,
  getUpscaleTarget,
  listUpscales,
  startUpscale,
  toUpscaleView,
} from '@easyrender/core';
import { NextResponse } from 'next/server';
import { resolveActor } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

export const maxDuration = 60;

// Body: { "kind": "view", "viewSetId", "view" } or { "kind": "sheet", "renderId" }.
// Spends the upscale price once, refunded if it fails. Asking again for the same picture returns
// the earlier enlargement and charges nothing.
export const POST = (request: Request) =>
  apiHandle(request, async () => {
    const actor = await resolveActor(request.headers, 'spend');
    if (!actor.userId) throw new AppError('Sign in to upscale', 401, 'unauthorized');
    const body = await request.json().catch(() => null);
    const row = await startUpscale(getUpscaleTarget(body), actor);
    return NextResponse.json(toUpscaleView(row), { status: 202 });
  });

// ?renderId= or ?viewSetId=: the owner's enlargements of that render or views set.
export const GET = (request: Request) =>
  apiHandle(request, async () => {
    const actor = await resolveActor(request.headers);
    if (!actor.userId) throw new AppError('Sign in to see your upscales', 401, 'unauthorized');
    const params = new URL(request.url).searchParams;
    const rows = await listUpscales(actor, {
      renderId: params.get('renderId') ?? undefined,
      viewSetId: params.get('viewSetId') ?? undefined,
    });
    return NextResponse.json(
      { upscales: rows.map(toUpscaleView).filter((view) => view !== null) },
      { headers: { 'cache-control': 'no-store' } },
    );
  });

export const OPTIONS = apiOptions;
