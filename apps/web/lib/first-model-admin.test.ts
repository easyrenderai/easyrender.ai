import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  configure: vi.fn(async (input: unknown) => input),
  isEmailAvailable: true,
}));
vi.mock('./admin-analytics/session', () => ({ adminSession: mocks.session }));
vi.mock('@easyrender/core', async (original) => ({
  ...(await original<typeof import('@easyrender/core')>()),
  configureFirstModelCampaign: mocks.configure,
  serviceEmailAvailable: () => mocks.isEmailAvailable,
}));
const { POST } = await import('../app/api/admin/experiments/first-model/route');
beforeEach(() => {
  process.env.ADMIN_EMAILS = 'admin@example.test';
  mocks.configure.mockClear();
  mocks.isEmailAvailable = true;
  mocks.session.mockResolvedValue({ user: { email: 'admin@example.test', emailVerified: true } });
});
function request(origin = 'https://easyrender.ai') {
  return new Request('https://easyrender.ai/api/admin/experiments/first-model', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ isActive: true, maxOffers: 100 }),
  });
}
it('allows a verified administrator to start the bounded campaign', async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ isActive: true, maxOffers: 100 });
});
it('rejects cross-origin activation before any mutation', async () => {
  expect((await POST(request('https://elsewhere.test'))).status).toBe(403);
  expect(mocks.configure).not.toHaveBeenCalled();
});
it('rejects an unverified allowlisted email', async () => {
  mocks.session.mockResolvedValue({ user: { email: 'admin@example.test', emailVerified: false } });
  expect((await POST(request())).status).toBe(403);
  expect(mocks.configure).not.toHaveBeenCalled();
});
it('refuses activation when verification emails are unavailable', async () => {
  mocks.isEmailAvailable = false;
  expect((await POST(request())).status).toBe(503);
  expect(mocks.configure).not.toHaveBeenCalled();
});
