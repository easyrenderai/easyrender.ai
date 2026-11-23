import { getFile, getRender, isListed, isShared, notFound } from '@easyrender/core';
import { lockedPreview, resizedPreview, watermark } from '@easyrender/harness';
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
    // A paid sheet is the stored master, which can be several MB. The page asks for ?w=<pixels> to
    // draw it and gets a WebP of that width; the download link has no width and gets the master.
    const width = Number(new URL(request.url).searchParams.get('w'));
    const isResized = paid && !isLocked && Number.isInteger(width) && width >= 64;
    const bytes = isLocked
      ? await lockedPreview(original)
      : paid
        ? isResized
          ? await resizedPreview(original, width)
          : original
        : await watermark(original);
    return new Response(bytes as BodyInit, {
      headers: {
        'content-type': paid && !isLocked && !isResized ? 'image/png' : 'image/webp',
        'cache-control': 'private, max-age=60',
      },
    });
  });

export const OPTIONS = apiOptions;
