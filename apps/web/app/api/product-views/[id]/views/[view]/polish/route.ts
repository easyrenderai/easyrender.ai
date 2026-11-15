import { AppError, polishView, toViewSetView } from '@easyrender/core';
import { NextResponse } from 'next/server';
import { resolveActor } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

export const maxDuration = 60;

// Body: { "note": string }. Spends one view of credits to draw this view again, steered by what
// the owner says is wrong with it.
export const POST = (
  request: Request,
  { params }: RouteContext<'/api/product-views/[id]/views/[view]/polish'>,
) =>
  apiHandle(request, async () => {
    const { id, view } = await params;
    const actor = await resolveActor(request.headers, 'spend');
    if (!actor.userId) throw new AppError('Sign in to polish a view', 401, 'unauthorized');
    const body = (await request.json().catch(() => null)) as { note?: unknown } | null;
    if (typeof body?.note !== 'string') {
      throw new AppError('Describe what to fix in this view', 400, 'empty_note');
    }
    return NextResponse.json(toViewSetView(await polishView(id, view, actor, body.note)));
  });

export const OPTIONS = apiOptions;
