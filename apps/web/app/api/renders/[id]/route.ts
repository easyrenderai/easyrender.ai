import { AppError, getRender, setVisibility, toView } from '@easyrender/core';
import { NextResponse } from 'next/server';
import { resolveActor } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

export const maxDuration = 60;

export const GET = (request: Request, { params }: RouteContext<'/api/renders/[id]'>) =>
  apiHandle(request, async () => {
    const { id } = await params;
    const render = await getRender(id, await resolveActor(request.headers));
    return NextResponse.json(toView(render), { headers: { 'cache-control': 'no-store' } });
  });

// Body: { "isPublic": boolean }. Shows or hides the render in the public gallery.
export const PATCH = (request: Request, { params }: RouteContext<'/api/renders/[id]'>) =>
  apiHandle(request, async () => {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (typeof body?.isPublic !== 'boolean') {
      throw new AppError('Send { "isPublic": true | false }', 400, 'bad_body');
    }
    const render = await setVisibility(
      id,
      await resolveActor(request.headers, 'share'),
      body.isPublic,
    );
    return NextResponse.json(toView(render));
  });

export const OPTIONS = apiOptions;
