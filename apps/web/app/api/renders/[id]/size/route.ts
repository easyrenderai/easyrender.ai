import { getRenderSize, saveRenderSize } from '@easyrender/core';
import { NextResponse } from 'next/server';
import { resolveActor } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

// The render's real size, in centimetres, or null when nobody has set one.
export const GET = (request: Request, { params }: RouteContext<'/api/renders/[id]/size'>) =>
  apiHandle(request, async () => {
    const { id } = await params;
    const size = await getRenderSize(id, await resolveActor(request.headers));
    return NextResponse.json(size, { headers: { 'cache-control': 'no-store' } });
  });

// Body: { "size": { "widthCm", "depthCm", "heightCm" } } with sides from 1 to 10000 cm. Send
// { "size": null } to remove it. The AR page and the downloads then show the piece at that size,
// scaled from the height (or from the larger floor side when there is no height). Owner only.
export const PUT = (request: Request, { params }: RouteContext<'/api/renders/[id]/size'>) =>
  apiHandle(request, async () => {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const size = await saveRenderSize(id, await resolveActor(request.headers, 'write'), body?.size);
    return NextResponse.json(size);
  });

export const OPTIONS = apiOptions;
