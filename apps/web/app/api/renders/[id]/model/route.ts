import {
  canAccess,
  getFile,
  getFileStream,
  getRender,
  isListed,
  isShared,
  notFound,
  servedModel,
  viewModelKey,
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
    const query = new URL(request.url).searchParams;
    const download = query.get('download') === '1';
    // The default is the generated file itself: API clients and downloads get the full model.
    // Viewers ask for ?view=1 and get the lighter copy of it (smaller textures, fewer triangles).
    const key = query.get('view') === '1' && !download ? await viewModelKey(render) : render.glbKey;
    const body = isEdited ? servedModel(render, await getFile(key)) : await getFileStream(key);
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
