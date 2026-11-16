import { beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  row: {
    id: 'upload',
    userId: 'owner',
    sourceKey: 'local:upload',
    contentType: 'image/png',
    size: 3,
    expiresAt: new Date(Date.now() + 60_000),
  },
  getFile: vi.fn(async () => new Uint8Array([1, 2, 3])),
}));
vi.mock('@easyrender/db', () => ({
  db: () => ({ imageUpload: { findUnique: async () => state.row } }),
}));
vi.mock('./storage', () => ({ getFile: state.getFile, putFile: vi.fn() }));
vi.mock('./api-limits', () => ({ consumeApiRateLimit: vi.fn() }));

const { getUploadedImage } = await import('./uploads');

beforeEach(() => {
  state.row.userId = 'owner';
  state.row.expiresAt = new Date(Date.now() + 60_000);
  state.getFile.mockClear();
});

it('reads an unexpired upload only for its authenticated owner', async () => {
  expect(await getUploadedImage('upload', { userId: 'owner' })).toEqual({
    bytes: new Uint8Array([1, 2, 3]),
    contentType: 'image/png',
  });
});

it.each([{ userId: 'other' }, {}, { anonId: 'owner' }])(
  'does not read storage for a different or anonymous actor',
  async (actor) => {
    await expect(getUploadedImage('upload', actor)).rejects.toMatchObject({ status: 404 });
    expect(state.getFile).not.toHaveBeenCalled();
  },
);

it('refuses an expired upload even for its owner', async () => {
  state.row.expiresAt = new Date(Date.now() - 1);
  await expect(getUploadedImage('upload', { userId: 'owner' })).rejects.toMatchObject({
    status: 404,
  });
  expect(state.getFile).not.toHaveBeenCalled();
});
