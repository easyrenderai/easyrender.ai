import { AppError, startBuild, toView } from '@easyrender/core';
import { NextResponse } from 'next/server';
import { resolveActor } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

export const maxDuration = 60;

// Spends the render credits and starts the 3D build from the approved preview.
export const POST = (request: Request, { params }: RouteContext<'/api/renders/[id]/render'>) =>
  apiHandle(request, async () => {
    const { id } = await params;
    const actor = await resolveActor(request.headers, 'spend');
    if (!actor.userId) throw new AppError('Sign up to render in 3D', 401, 'unauthorized');
    return NextResponse.json(toView(await startBuild(id, actor)));
  });

export const OPTIONS = apiOptions;
