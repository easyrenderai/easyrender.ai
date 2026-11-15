import { db } from '@easyrender/db';
import { checkPhoto } from '@easyrender/harness';
import { consumeApiRateLimit } from './api-limits';
import { AppError, notFound } from './errors';
import { type Actor, extension, IMAGE_TYPES, MAX_UPLOAD_BYTES } from './renders';
import { getFile, putFile } from './storage';

export const UPLOAD_TTL_SECONDS = 3600;

export async function createUploadedImage(actor: Actor, bytes: Uint8Array, contentType: string) {
  if (!actor.userId) throw new AppError('Authentication required', 401, 'unauthorized');
  if (!IMAGE_TYPES.has(contentType))
    throw new AppError('Upload a JPEG, PNG or WebP photo', 415, 'bad_type');
  if (!bytes.byteLength || bytes.byteLength > MAX_UPLOAD_BYTES)
    throw new AppError('Photo must be between 1 byte and 4 MiB', 413, 'too_large');
  await consumeApiRateLimit(`uploads:${actor.userId}`, 60, 3600);
  const checked = await checkPhoto(bytes);
  if (!checked.ok) throw new AppError(checked.message, 422, checked.code);
  const sourceKey = await putFile(`uploads/photo.${extension(contentType)}`, bytes, contentType);
  const row = await db().imageUpload.create({
    data: {
      userId: actor.userId,
      sourceKey,
      contentType,
      size: bytes.byteLength,
      expiresAt: new Date(Date.now() + UPLOAD_TTL_SECONDS * 1000),
    },
  });
  return {
    id: row.id,
    contentType: row.contentType,
    size: row.size,
    expiresAt: row.expiresAt.toISOString(),
  };
}

export async function getUploadedImage(id: string, actor: Actor) {
  const row = await db().imageUpload.findUnique({ where: { id } });
  if (!actor.userId || !row || row.userId !== actor.userId || row.expiresAt <= new Date())
    throw notFound();
  return { bytes: await getFile(row.sourceKey), contentType: row.contentType };
}
