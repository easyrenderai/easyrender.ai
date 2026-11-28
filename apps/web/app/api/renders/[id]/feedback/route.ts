import { saveModelFeedback } from '@easyrender/core';
import { NextResponse } from 'next/server';
import { resolveActor } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

export const POST = (request: Request, { params }: RouteContext<'/api/renders/[id]/feedback'>) =>
  apiHandle(request, async () => {
    const actor = await resolveActor(request.headers, 'write');
    const { id } = await params;
    const body: unknown = await request.json().catch(() => null);
    const result = await saveModelFeedback(id, actor, body);
    return NextResponse.json(result, { status: 201 });
  });

export const OPTIONS = apiOptions;
