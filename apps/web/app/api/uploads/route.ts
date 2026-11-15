import { AppError, createUploadedImage, MAX_UPLOAD_BYTES } from '@easyrender/core';
import { resolveActor } from '@/lib/actor';
import { handle } from '@/lib/http';

export const maxDuration = 30;

export const POST = (request: Request) =>
  handle(async () => {
    const actor = await resolveActor(request.headers);
    if (!actor.userId) throw new AppError('Authentication required', 401, 'unauthorized');
    const form = await request.formData().catch(() => null);
    const image = form?.get('image');
    if (!(image instanceof File)) throw new AppError('Attach a photo as image', 400, 'no_image');
    if (image.size > MAX_UPLOAD_BYTES)
      throw new AppError('Photo is larger than 4 MiB', 413, 'too_large');
    return Response.json(
      await createUploadedImage(actor, new Uint8Array(await image.arrayBuffer()), image.type),
      { status: 201, headers: { 'cache-control': 'no-store' } },
    );
  });
