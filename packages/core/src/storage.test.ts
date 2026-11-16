import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';

const send = vi.hoisted(() => vi.fn(async (_command: unknown) => ({})));
vi.mock('@aws-sdk/client-s3', async (original) => ({
  ...(await original<typeof import('@aws-sdk/client-s3')>()),
  S3Client: class {
    send = send;
  },
}));

import { deleteUploadFile, getFile, getFileStream, putFile } from './storage';

let directory: string | undefined;
afterEach(async () => {
  vi.unstubAllEnvs();
  if (directory) await rm(directory, { recursive: true, force: true });
});
async function local() {
  directory = await mkdtemp(join(tmpdir(), 'easyrender-storage-'));
  vi.stubEnv('DATA_DIR', directory);
  vi.stubEnv('S3_BUCKET', '');
  vi.stubEnv('VERCEL', '');
}
it('streams the stored bytes without buffering a full model', async () => {
  await local();
  const bytes = new Uint8Array(1024 * 1024).fill(7);
  const key = await putFile('models/test.glb', bytes, 'model/gltf-binary');
  const stream = await getFileStream(key);
  expect(new Uint8Array(await new Response(stream).arrayBuffer())).toEqual(bytes);
});
it('only removes temporary uploads and refuses traversal or permanent model keys', async () => {
  await local();
  const key = await putFile('uploads/photo.png', new Uint8Array([1]), 'image/png');
  await deleteUploadFile(key);
  await expect(getFile(key)).rejects.toMatchObject({ code: 'ENOENT' });
  for (const key of [
    'local:../secret',
    'local:uploads/../model.glb',
    'local:models/test.glb',
    'https://evil.example/renders/uploads/photo.png',
  ]) {
    await expect(deleteUploadFile(key)).rejects.toThrow('invalid temporary upload key');
  }
});

it('prevents temporary uploads from getting the permanent model cache lifetime', async () => {
  vi.stubEnv('S3_BUCKET', 'test-bucket');
  vi.stubEnv('ASSETS_CDN_URL', 'https://assets.example');
  vi.stubEnv('AWS_ROLE_ARN', '');
  send.mockClear();
  const key = await putFile('uploads/photo.png', new Uint8Array([1]), 'image/png');
  expect(send.mock.calls[0]?.[0]).toMatchObject({
    input: { CacheControl: 'private, no-store, max-age=0' },
  });
  await deleteUploadFile(key);
  expect(send.mock.calls[1]?.[0]).toMatchObject({
    input: { Bucket: 'test-bucket', Key: expect.stringMatching(/^renders\/uploads\//) },
  });
});
