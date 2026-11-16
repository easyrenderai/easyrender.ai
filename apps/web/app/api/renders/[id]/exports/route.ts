import { createModelExport } from '@easyrender/core';
import { NextResponse } from 'next/server';
import { resolveActor } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

// A converter that starts cold and then converts stays well under this.
export const maxDuration = 120;

// Body: { "format": "obj" | "fbx" | "blend" }. Owner only. Converts the model as the owner sees
// it (material edits included) and answers a download link that works for ten minutes.
export const POST = (request: Request, { params }: RouteContext<'/api/renders/[id]/exports'>) =>
  apiHandle(request, async () => {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const result = await createModelExport(id, await resolveActor(request.headers), body?.format);
    return NextResponse.json(result);
  });

export const OPTIONS = apiOptions;
