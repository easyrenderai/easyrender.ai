import { AppError, createUploadedImage } from '@easyrender/core';
import { resolveActor } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';
import { parseApiPhoto } from '@/lib/api-upload';

export const maxDuration = 30;

export const POST = (request: Request) =>
  apiHandle(request, async () => {
    const actor = await resolveActor(request.headers, 'write');
    if (!actor.userId) throw new AppError('Authentication required', 401, 'unauthorized');
    const photo = await parseApiPhoto(request, actor, false);
    return Response.json(await createUploadedImage(actor, photo.bytes, photo.contentType), {
      status: 201,
      headers: { 'cache-control': 'no-store' },
    });
  });

export const OPTIONS = apiOptions;
