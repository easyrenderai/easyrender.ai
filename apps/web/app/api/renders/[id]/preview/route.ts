import { getFile, getRender, isListed, isShared, notFound } from '@easyrender/core';
import { lockedPreview, watermark } from '@easyrender/harness';
import { resolveActor } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

export const maxDuration = 60;

// The angle sheet, watermarked until the render has been paid for. A visitor without an account
// gets a blurred copy of a private sheet; the gallery and shared renders stay readable.
export const GET = (request: Request, { params }: RouteContext<'/api/renders/[id]/preview'>) =>
  apiHandle(request, async () => {
    const { id } = await params;
    const actor = await resolveActor(request.headers);
    const render = await getRender(id, actor);
    const key = render.sheetKey ?? (render.status === 'drafting' ? null : render.sourceKey);
    if (!key || key.startsWith('pending:')) throw notFound();
    const original = await getFile(key);
    const paid = render.credits > 0;
    const isLocked = !actor.userId && !paid && !isListed(render) && !isShared(render);
    const bytes = isLocked
      ? await lockedPreview(original)
      : paid
        ? original
        : await watermark(original);
    return new Response(bytes as BodyInit, {
      headers: {
        'content-type': paid && !isLocked ? 'image/png' : 'image/webp',
        'cache-control': 'private, max-age=60',
      },
    });
  });

export const OPTIONS = apiOptions;
