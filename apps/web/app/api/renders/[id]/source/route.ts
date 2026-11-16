import { canView, getFile, notFound } from '@easyrender/core';
import { db } from '@easyrender/db';
import { resolveActor } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

export const maxDuration = 60;

// The photo the render was made from. Reads the row directly (no pipeline nudge), so a
// library grid of thumbnails never calls Replicate.
export const GET = (request: Request, { params }: RouteContext<'/api/renders/[id]/source'>) =>
  apiHandle(request, async () => {
    const { id } = await params;
    const render = await db().render.findUnique({ where: { id } });
    if (!render || !canView(render, await resolveActor(request.headers))) throw notFound();
    if (render.sourceKey.startsWith('pending:')) throw notFound();
    const bytes = await getFile(render.sourceKey);
    const ext = render.sourceKey.split('.').pop();
    const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return new Response(bytes as BodyInit, {
      headers: { 'content-type': type, 'cache-control': 'private, max-age=3600' },
    });
  });

export const OPTIONS = apiOptions;
