import { type Actor, AppError, fetchRemoteImage, getUploadedImage } from '@easyrender/core';
import { z } from 'zod';

// Leaves space for JSON, notes and client metadata inside the transport's 4 MiB envelope.
export const MAX_INLINE_IMAGE_BYTES = 3 * 1024 * 1024 - 16 * 1024;
export const imageInputSchema = {
  upload_id: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .describe('Owner-scoped id from authenticated POST /api/uploads; expires after one hour'),
  image_url: z
    .string()
    .url()
    .max(4096)
    .optional()
    .describe('Public HTTPS JPEG, PNG or WebP URL; up to 4 MiB'),
  image_base64: z
    .string()
    .max(4 * Math.ceil(MAX_INLINE_IMAGE_BYTES / 3))
    .optional()
    .describe(
      `Canonical base64, at most ${MAX_INLINE_IMAGE_BYTES} decoded bytes; requires content_type`,
    ),
  content_type: z.enum(['image/jpeg', 'image/png', 'image/webp']).optional(),
};
type ImageInput = {
  upload_id?: string;
  image_url?: string;
  image_base64?: string;
  content_type?: string;
};
export async function readImage(input: ImageInput, actor: Actor) {
  const { upload_id, image_url, image_base64, content_type } = input;
  if ([upload_id, image_url, image_base64].filter(Boolean).length !== 1)
    throw new AppError(
      'Supply exactly one upload_id, image_url or image_base64',
      400,
      'invalid_image_input',
    );
  if ((image_url || upload_id) && content_type)
    throw new AppError('content_type is only used with image_base64', 400, 'invalid_image_input');
  if (upload_id) return getUploadedImage(upload_id, actor);
  if (image_url) return fetchRemoteImage(image_url);
  if (
    !content_type ||
    !image_base64 ||
    image_base64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(image_base64)
  )
    throw new AppError('Supply canonical base64 and its content_type', 400, 'invalid_image_input');
  const bytes = Buffer.from(image_base64, 'base64');
  if (bytes.toString('base64') !== image_base64)
    throw new AppError('Invalid base64 encoding', 400, 'invalid_image_input');
  if (bytes.byteLength > MAX_INLINE_IMAGE_BYTES)
    throw new AppError(
      'Inline photo is too large; use an uploaded image or image_url',
      413,
      'too_large',
    );
  return { bytes: new Uint8Array(bytes), contentType: content_type };
}
