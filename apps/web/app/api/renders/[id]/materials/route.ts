import { getRenderMaterials, saveMaterialEdits } from '@easyrender/core';
import { NextResponse } from 'next/server';
import { resolveActor } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

export const maxDuration = 60;

// The materials of the render's GLB and the owner's edits on top of them.
export const GET = (request: Request, { params }: RouteContext<'/api/renders/[id]/materials'>) =>
  apiHandle(request, async () => {
    const { id } = await params;
    const materials = await getRenderMaterials(id, await resolveActor(request.headers));
    return NextResponse.json(materials, { headers: { 'cache-control': 'no-store' } });
  });

// Body: { "edits": [{ "index", "baseColor": [r, g, b], "roughness", "metalness" }] }, values 0..1.
// Replaces every edit of the render; an empty list resets it to the generated look. Owner only.
export const PUT = (request: Request, { params }: RouteContext<'/api/renders/[id]/materials'>) =>
  apiHandle(request, async () => {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const materials = await saveMaterialEdits(
      id,
      await resolveActor(request.headers, 'write'),
      body?.edits,
    );
    return NextResponse.json(materials);
  });

export const OPTIONS = apiOptions;
