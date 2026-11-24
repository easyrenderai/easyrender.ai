import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ render: vi.fn(), read: vi.fn() }));
vi.mock('@easyrender/db', () => ({ db: () => ({ render: { findUnique: mocks.render } }) }));
vi.mock('../storage', () => ({ getFileStream: mocks.read }));

import { readAdminAsset, signAdminAsset, verifyAdminAsset } from './render-assets';

const now = Date.parse('2026-11-20T00:00:00Z');
beforeEach(() => {
  vi.stubEnv('BETTER_AUTH_SECRET', 'test-only-admin-signature-fixture');
  vi.stubEnv('ASSETS_CDN_URL', 'https://assets.example.test');
  vi.stubEnv('VERCEL', '1');
  mocks.render.mockResolvedValue({
    glbKey: 'https://assets.example.test/renders/model.glb',
    viewGlbKey: null,
    sheetKey: 'https://assets.example.test/renders/sheet.png',
    sourceKey: 'https://assets.example.test/renders/source.jpg',
  });
  mocks.read.mockImplementation(async () => new Blob(['fixture']).stream());
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it('signs only a render and asset for five minutes, never a storage URL', () => {
  const url = new URL(signAdminAsset('r1', 'glb', now), 'https://app.test');
  expect(url.pathname).toBe('/api/admin/renders/r1/files/glb');
  expect(url.href).not.toContain('assets.example');
  expect(() => verifyAdminAsset('r1', 'glb', url.searchParams, now + 299_000)).not.toThrow();
  for (const [id, asset, time] of [
    ['other', 'glb', now],
    ['r1', 'view', now],
    ['r1', 'glb', now + 300_000],
    ['r1', 'glb', now - 1000],
  ] as const) {
    expect(() => verifyAdminAsset(id, asset, url.searchParams, time)).toThrow(
      'Asset link expired or invalid',
    );
  }
  url.searchParams.set('expires', String(now / 1000 + 299));
  expect(() => verifyAdminAsset('r1', 'glb', url.searchParams, now)).toThrow();
});
it('fails closed with missing signatures, secrets and unknown formats', () => {
  expect(() => verifyAdminAsset('r1', 'glb', new URLSearchParams(), now)).toThrow();
  expect(() => signAdminAsset('r1', 'fbx', now)).toThrow('Asset not found');
  vi.stubEnv('BETTER_AUTH_SECRET', '');
  expect(() => signAdminAsset('r1', 'glb', now)).toThrow('Asset signing unavailable');
});
it('reads existing viewing copy, otherwise the original, without optimizing or writing', async () => {
  const file = await readAdminAsset('r1', 'view');
  expect(await new Response(file.body).text()).toBe('fixture');
  expect(file).toMatchObject({ contentType: 'model/gltf-binary', isDownload: false });
  expect(mocks.read).toHaveBeenCalledWith(
    'https://assets.example.test/renders/model.glb',
    expect.objectContaining({ redirect: 'error' }),
  );
  mocks.render.mockResolvedValue({
    glbKey: 'https://assets.example.test/renders/model.glb',
    viewGlbKey: 'https://assets.example.test/renders/view.glb',
  });
  await readAdminAsset('r1', 'view');
  expect(mocks.read).toHaveBeenLastCalledWith(
    'https://assets.example.test/renders/view.glb',
    expect.anything(),
  );
  await readAdminAsset('r1', 'glb');
  expect(mocks.read).toHaveBeenLastCalledWith(
    'https://assets.example.test/renders/model.glb',
    expect.anything(),
  );
});
it.each([
  'http://127.0.0.1/private.glb',
  'https://assets.example.test.evil/renders/a.glb',
  'https://evil.test/renders/a.glb',
  'https://assets.example.test/renders/../private.glb',
  'local:../secret.glb',
])('rejects untrusted stored locations: %s', async (key) => {
  mocks.render.mockResolvedValue({ glbKey: key });
  await expect(readAdminAsset('r1', 'glb')).rejects.toMatchObject({ status: 404 });
  expect(mocks.read).not.toHaveBeenCalled();
});
it('returns not found for missing renders or assets', async () => {
  mocks.render.mockResolvedValue(null);
  await expect(readAdminAsset('missing', 'glb')).rejects.toMatchObject({ status: 404 });
  mocks.render.mockResolvedValue({ glbKey: null });
  await expect(readAdminAsset('r1', 'glb')).rejects.toMatchObject({ status: 404 });
});
