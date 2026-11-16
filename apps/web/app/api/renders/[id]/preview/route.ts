import { getFile, getRender, notFound } from '@easyrender/core';
import { watermark } from '@easyrender/harness';
import { resolveActor } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

export const maxDuration = 60;

// The angle sheet, watermarked until the render has been paid for.
export const GET = (request: Request, { params }: RouteContext<'/api/renders/[id]/preview'>) =>
  apiHandle(request, async () => {
    const { id } = await params;
    const render = await getRender(id, await resolveActor(request.headers));
    const key = render.sheetKey ?? (render.status === 'drafting' ? null : render.sourceKey);
    if (!key || key.startsWith('pending:')) throw notFound();
    const original = await getFile(key);
    const paid = render.credits > 0;
    const bytes = paid ? original : await watermark(original);
    return new Response(bytes as BodyInit, {
      headers: {
        'content-type': paid ? 'image/png' : 'image/webp',
        'cache-control': 'private, max-age=60',
      },
    });
  });

export const OPTIONS = apiOptions;
