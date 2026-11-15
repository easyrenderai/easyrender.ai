import { beforeEach, expect, it, vi } from 'vitest';

const resolveUpload = vi.hoisted(() =>
  vi.fn(async () => ({ bytes: new Uint8Array([1]), contentType: 'image/png' })),
);
vi.mock('@easyrender/core', async (original) => ({
  ...(await original<typeof import('@easyrender/core')>()),
  getUploadedImage: resolveUpload,
}));

import { parseApiPhoto } from './api-upload';

beforeEach(() => resolveUpload.mockClear());
const json = (body: unknown) =>
  new Request('https://easyrender.ai/api/renders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

it('resolves an upload reference with the authenticated actor and explicit privacy', async () => {
  const actor = { userId: 'owner' };
  expect(await parseApiPhoto(json({ upload_id: 'photo', isPublic: false }), actor)).toMatchObject({
    isPublic: false,
    contentType: 'image/png',
  });
  expect(resolveUpload).toHaveBeenCalledWith('photo', actor);
});
it('rejects mixed sources, invalid booleans and overlong prompts before reading storage', async () => {
  for (const body of [
    { upload_id: 'photo', image: 'fake' },
    { upload_id: 'photo', isPublic: 'false-ish' },
    { upload_id: 'photo', prompt: 'x'.repeat(501) },
  ]) {
    await expect(parseApiPhoto(json(body), { userId: 'owner' })).rejects.toMatchObject({
      status: 400,
    });
  }
  expect(resolveUpload).not.toHaveBeenCalled();
});
it('accepts a multipart file and never resolves another owner reference', async () => {
  const form = new FormData();
  form.set('image', new File(['photo'], 'photo.png', { type: 'image/png' }));
  form.set('isPublic', 'false');
  expect(
    await parseApiPhoto(
      new Request('https://easyrender.ai/api/renders', { method: 'POST', body: form }),
      { userId: 'owner' },
    ),
  ).toMatchObject({ bytes: new TextEncoder().encode('photo'), isPublic: false });
  expect(resolveUpload).not.toHaveBeenCalled();
});
it('bounds actual body bytes without trusting Content-Length', async () => {
  await expect(
    parseApiPhoto(json({ upload_id: 'x'.repeat(5 * 1024 * 1024) }), { userId: 'owner' }),
  ).rejects.toMatchObject({ status: 413 });
  expect(resolveUpload).not.toHaveBeenCalled();
});
it('does not accept recursive upload references at the upload endpoint', async () => {
  await expect(
    parseApiPhoto(json({ upload_id: 'photo' }), { userId: 'owner' }, false),
  ).rejects.toMatchObject({ status: 400 });
});
