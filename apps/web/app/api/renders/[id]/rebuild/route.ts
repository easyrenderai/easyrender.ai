import { AppError, rebuildStandard, toView } from '@easyrender/core';
import { NextResponse } from 'next/server';
import { resolveActor } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

export const maxDuration = 60;

// Rebuilds a Medium or High model in Standard, free, and returns the credit difference once.
export const POST = (request: Request, { params }: RouteContext<'/api/renders/[id]/rebuild'>) =>
  apiHandle(request, async () => {
    const { id } = await params;
    const actor = await resolveActor(request.headers, 'spend');
    if (!actor.userId) throw new AppError('Sign in to rebuild this model', 401, 'unauthorized');
    return NextResponse.json(toView(await rebuildStandard(id, actor)));
  });

export const OPTIONS = apiOptions;
