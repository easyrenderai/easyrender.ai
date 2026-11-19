import { getRenderQuality } from '@easyrender/core';
import { NextResponse } from 'next/server';
import { resolveActor } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

export const GET = (request: Request, { params }: RouteContext<'/api/renders/[id]/quality'>) =>
  apiHandle(request, async () => {
    const { id } = await params;
    const quality = await getRenderQuality(id, await resolveActor(request.headers));
    return NextResponse.json(quality, { headers: { 'cache-control': 'private, no-store' } });
  });

export const OPTIONS = apiOptions;
