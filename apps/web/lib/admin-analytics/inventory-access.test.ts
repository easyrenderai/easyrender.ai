import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  buyers: vi.fn(),
  renders: vi.fn(),
  read: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('./session', () => ({ adminSession: mocks.session }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
vi.mock('@easyrender/core/admin-analytics', async (original) => ({
  ...(await original<typeof import('@easyrender/core/admin-analytics')>()),
  loadBuyers: mocks.buyers,
  loadAdminRenders: mocks.renders,
  readAdminAsset: mocks.read,
}));

import { GET as issue } from '@/app/api/admin/renders/[id]/assets/[asset]/route';
import { GET as file } from '@/app/api/admin/renders/[id]/files/[asset]/route';
import { buyersData, rendersData } from './inventory';

beforeEach(() => {
  vi.stubEnv('ADMIN_EMAILS', 'owner@example.test');
  vi.stubEnv('BETTER_AUTH_SECRET', 'test-only-admin-signature-fixture');
  mocks.session.mockResolvedValue({ user: { email: 'owner@example.test', emailVerified: true } });
  mocks.buyers.mockResolvedValue([]);
  mocks.renders.mockResolvedValue({ renders: [], page: 1, pages: 1, total: 0 });
  mocks.read.mockImplementation(async () => ({
    body: new Blob(['model-fixture']).stream(),
    contentType: 'model/gltf-binary',
    extension: 'glb',
    isDownload: true,
  }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
const context = { params: Promise.resolve({ id: 'r1', asset: 'glb' }) };
const request = (path = '/api/admin/renders/r1/assets/glb') =>
  new Request(`https://app.test${path}`);

it.each([
  [null, 401, 'REDIRECT:/sign-in'],
  [{ email: 'reader@example.test', emailVerified: true }, 403, 'NOT_FOUND'],
  [{ email: 'owner@example.test', emailVerified: false }, 403, 'REDIRECT:/sign-in/admin'],
])(
  'rejects unauthorized users on both data loaders and both asset routes',
  async (user, status, error) => {
    mocks.session.mockResolvedValue(user ? { user } : null);
    await expect(buyersData()).rejects.toThrow(error);
    await expect(rendersData()).rejects.toThrow(error);
    for (const handler of [issue, file]) {
      const response = await handler(request(), context);
      expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
    }
    expect(mocks.buyers).not.toHaveBeenCalled();
    expect(mocks.renders).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
  },
);
it('requires both a current verified admin and a valid signed link to serve bytes', async () => {
  const redirect = await issue(request(), context);
  expect(redirect.status).toBe(307);
  const path = redirect.headers.get('location');
  expect(path).toContain('/files/glb?expires=');
  const response = await file(request(path as string), context);
  expect(response.status).toBe(200);
  expect(await response.text()).toBe('model-fixture');
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('content-disposition')).toContain('attachment');
  expect(response.headers.has('access-control-allow-origin')).toBe(false);
  mocks.session.mockResolvedValue(null);
  expect((await file(request(path as string), context)).status).toBe(401);
});
it('rejects missing, expired or tampered tokens even for admins', async () => {
  const redirect = await issue(request(), context);
  const url = new URL(redirect.headers.get('location') as string, 'https://app.test');
  url.searchParams.set('signature', '0'.repeat(64));
  expect((await file(new Request(url), context)).status).toBe(403);
  url.searchParams.set('expires', '1');
  expect((await file(new Request(url), context)).status).toBe(403);
  expect((await file(request('/api/admin/renders/r1/files/glb'), context)).status).toBe(403);
  expect(mocks.read).not.toHaveBeenCalled();
});
