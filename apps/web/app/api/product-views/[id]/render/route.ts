import { AppError, createRenderFromViews } from '@easyrender/core';
import { NextResponse } from 'next/server';
import { resolveActor } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

export const maxDuration = 60;

// Makes a 3D render from the finished views, ready to build for the 3D step only. Free: the
// build itself is what costs credits, on the render's page. Asking again returns the same render.
export const POST = (
  request: Request,
  { params }: RouteContext<'/api/product-views/[id]/render'>,
) =>
  apiHandle(request, async () => {
    const { id } = await params;
    const actor = await resolveActor(request.headers, 'write');
    if (!actor.userId) throw new AppError('Sign in to build in 3D', 401, 'unauthorized');
    return NextResponse.json({ renderId: await createRenderFromViews(id, actor) });
  });

export const OPTIONS = apiOptions;
