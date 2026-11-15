import {
  canAccess,
  getFile,
  getFileStream,
  getRender,
  isListed,
  isShared,
  notFound,
  servedModel,
} from '@easyrender/core';
import { resolveActor } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

export const maxDuration = 60;

export const GET = (request: Request, { params }: RouteContext<'/api/renders/[id]/model'>) =>
  apiHandle(request, async () => {
    const { id } = await params;
    const actor = await resolveActor(request.headers);
    const render = await getRender(id, actor);
    if (render.status !== 'ready' || !render.glbKey) throw notFound();
    // Owners download their model; anyone can view a render that is in the public gallery.
    const owner = canAccess(render, actor) && Boolean(actor.userId);
    if (!owner && !isListed(render) && !isShared(render)) throw notFound();
    const isEdited = Array.isArray(render.materialEdits) && render.materialEdits.length > 0;
    const body = isEdited
      ? servedModel(render, await getFile(render.glbKey))
      : await getFileStream(render.glbKey);
    const download = new URL(request.url).searchParams.get('download') === '1';
    return new Response(body as BodyInit, {
      headers: {
        'content-type': 'model/gltf-binary',
        // An edited model must show the edit at once, so it is revalidated instead of cached.
        'cache-control': isEdited
          ? 'no-cache'
          : owner
            ? 'private, max-age=3600'
            : 'public, max-age=3600',
        // Shoppers on a store's own pages fetch the model from here.
        ...(isShared(render) ? { 'access-control-allow-origin': '*' } : {}),
        ...(download
          ? { 'content-disposition': `attachment; filename="easyrender-${id}.glb"` }
          : {}),
      },
    });
  });

export const OPTIONS = apiOptions;
