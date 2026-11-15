import { AppError, redrawSheet, toView } from '@easyrender/core';
import { NextResponse } from 'next/server';
import { resolveActor } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

export const maxDuration = 60;

// Spends one sheet of credits to redraw the angle sheet, steered by what the owner says is wrong.
export const POST = (
  request: Request,
  { params }: RouteContext<'/api/renders/[id]/sheet/redraw'>,
) =>
  apiHandle(request, async () => {
    const { id } = await params;
    const actor = await resolveActor(request.headers, 'spend');
    if (!actor.userId) throw new AppError('Sign up to redraw the angle sheet', 401, 'unauthorized');
    const body = (await request.json().catch(() => null)) as { note?: unknown } | null;
    if (typeof body?.note !== 'string') {
      throw new AppError('Describe what to fix in the angle sheet', 400, 'empty_note');
    }
    return NextResponse.json(toView(await redrawSheet(id, actor, body.note)));
  });

export const OPTIONS = apiOptions;
