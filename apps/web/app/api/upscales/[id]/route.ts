import { getUpscale, toUpscaleView } from '@easyrender/core';
import { NextResponse } from 'next/server';
import { resolveActor } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

export const maxDuration = 60;

export const GET = (request: Request, { params }: RouteContext<'/api/upscales/[id]'>) =>
  apiHandle(request, async () => {
    const { id } = await params;
    const row = await getUpscale(id, await resolveActor(request.headers));
    return NextResponse.json(toUpscaleView(row), { headers: { 'cache-control': 'no-store' } });
  });

export const OPTIONS = apiOptions;
