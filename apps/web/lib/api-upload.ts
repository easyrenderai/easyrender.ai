import {
  type Actor,
  AppError,
  fetchRemoteImage,
  getUploadedImage,
  MAX_UPLOAD_BYTES,
} from '@easyrender/core';

// Bound actual bytes even without Content-Length. Multipart overhead gets 64 KiB, not unbounded JSON/base64.
export async function parseApiPhoto(request: Request, actor: Actor, allowReference = true) {
  let received = 0;
  const body = request.body?.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > MAX_UPLOAD_BYTES + 64 * 1024)
          throw new AppError('Upload request is too large', 413, 'too_large');
        controller.enqueue(chunk);
      },
    }),
  );
  const bounded = new Response(body, {
    headers: { 'content-type': request.headers.get('content-type') ?? '' },
  });
  let value: Record<string, unknown>;
  try {
    if (request.headers.get('content-type')?.includes('application/json')) {
      const json: unknown = await bounded.json();
      if (!json || typeof json !== 'object' || Array.isArray(json))
        throw new AppError('Send a JSON object', 400, 'bad_body');
      value = json as Record<string, unknown>;
    } else {
      value = Object.fromEntries((await bounded.formData()).entries());
    }
  } catch (error) {
    if (received > MAX_UPLOAD_BYTES + 64 * 1024)
      throw new AppError('Upload request is too large', 413, 'too_large');
    if (error instanceof AppError) throw error;
    throw new AppError('Send multipart image or JSON upload_id/image_url', 400, 'bad_body');
  }
  const image = value.image;
  const uploadId = value.upload_id;
  const imageUrl = value.image_url;
  if (!allowReference && (uploadId !== undefined || imageUrl !== undefined))
    throw new AppError('Attach an image file', 400, 'invalid_image_input');
  if ([image, uploadId, imageUrl].filter((source) => source !== undefined).length !== 1)
    throw new AppError(
      'Pass exactly one image file, upload_id or image_url',
      400,
      'invalid_image_input',
    );
  for (const [field, source] of [
    ['upload_id', uploadId],
    ['image_url', imageUrl],
  ] as const) {
    if (source !== undefined && (typeof source !== 'string' || !source.trim()))
      throw new AppError(`${field} must be a non-empty string`, 400, 'bad_body');
  }
  if (image !== undefined && !(image instanceof File))
    throw new AppError('image must be a file', 400, 'bad_body');
  if (image instanceof File && image.size > MAX_UPLOAD_BYTES)
    throw new AppError('Photo is larger than 4 MiB', 413, 'too_large');
  for (const [field, max] of [
    ['prompt', 500],
    ['name', 120],
  ] as const) {
    if (
      value[field] !== undefined &&
      (typeof value[field] !== 'string' || value[field].length > max)
    )
      throw new AppError(`${field} must be at most ${max} characters`, 400, 'bad_body');
  }
  const visibility = value.isPublic;
  if (
    visibility !== undefined &&
    ![true, false, 'true', 'false'].includes(visibility as boolean | string)
  )
    throw new AppError('isPublic must be boolean', 400, 'bad_body');
  return {
    ...(image instanceof File
      ? { bytes: new Uint8Array(await image.arrayBuffer()), contentType: image.type }
      : typeof imageUrl === 'string'
        ? await fetchRemoteImage(imageUrl)
        : await getUploadedImage(uploadId as string, actor)),
    prompt: typeof value.prompt === 'string' ? value.prompt : null,
    name: typeof value.name === 'string' ? value.name : null,
    isPublic: visibility === undefined ? undefined : visibility === true || visibility === 'true',
    attribution: value.attribution,
  };
}
