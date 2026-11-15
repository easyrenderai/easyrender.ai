import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ session: vi.fn(), save: vi.fn(), invalidate: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('./session', () => ({ adminSession: mocks.session }));
vi.mock('next/cache', () => ({ revalidateTag: mocks.invalidate }));
vi.mock('@easyrender/core/admin-analytics', async (original) => ({
  ...(await original<typeof import('@easyrender/core/admin-analytics')>()),
  importAdvertisingSpend: mocks.save,
}));

import { POST } from '@/app/api/admin/analytics/ad-spend/route';

const request = (body = '{"records":[]}', headers: Record<string, string> = {}) =>
  new Request('https://easyrender.test/api/admin/analytics/ad-spend', {
    method: 'POST',
    headers: { origin: 'https://easyrender.test', 'content-type': 'application/json', ...headers },
    body,
  });
beforeEach(() => {
  mocks.session.mockResolvedValue({ user: { email: 'admin@example.test', emailVerified: true } });
  mocks.save.mockResolvedValue({ imported: 1 });
  vi.stubEnv('ADMIN_EMAILS', 'admin@example.test');
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
describe('admin spend import transport', () => {
  it('requires a same-origin verified allowlisted browser session', async () => {
    expect(
      (await POST(request('{}', { origin: 'https://attacker.test', authorization: 'Bearer test' })))
        .status,
    ).toBe(403);
    expect((await POST(request('{}', { origin: '' }))).status).toBe(403);
    mocks.session.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    mocks.session.mockResolvedValue({
      user: { email: 'admin@example.test', emailVerified: false },
    });
    expect((await POST(request())).status).toBe(403);
    mocks.session.mockResolvedValue({
      user: { email: 'reader@example.test', emailVerified: true },
    });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('rejects oversized streams, malformed JSON and wrong media types before importing', async () => {
    expect((await POST(request('x'.repeat(512001)))).status).toBe(413);
    expect((await POST(request('{'))).status).toBe(400);
    expect((await POST(request('{}', { 'content-type': 'text/plain' }))).status).toBe(415);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('returns import receipt without cache or CORS access and refreshes the admin report', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ imported: 1 });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.has('access-control-allow-origin')).toBe(false);
    expect(mocks.invalidate).toHaveBeenCalledWith('admin-analytics', { expire: 0 });
  });
});
