import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({
  principal: vi.fn(),
  session: vi.fn(),
  balance: vi.fn(),
  account: vi.fn(),
  limit: vi.fn(),
}));
vi.mock('@easyrender/core', async (original) => ({
  ...(await original<typeof import('@easyrender/core')>()),
  verifyApiKeyPrincipal: mocks.principal,
  getBalance: mocks.balance,
  consumeApiRateLimit: mocks.limit,
}));
vi.mock('@easyrender/db', () => ({ db: () => ({ user: { findUnique: mocks.account } }) }));
vi.mock('@/lib/actor', () => ({ currentUser: mocks.session }));

import { POST } from '@/app/api/connectors/verify/route';

const principal = {
  id: 'key-1',
  userId: 'owner',
  resource: null,
  scopes: ['read', 'spend'],
  expiresAt: new Date('2030-01-01'),
  creditLimit: 100,
  spentCredits: 30,
};
const request = (authorization?: string) =>
  new Request('https://easyrender.ai/api/connectors/verify', {
    method: 'POST',
    headers: authorization ? { authorization } : {},
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.principal.mockResolvedValue(principal);
  mocks.session.mockResolvedValue({ id: 'owner' });
  mocks.balance.mockResolvedValue(75);
  mocks.account.mockResolvedValue({ name: 'Example', email: 'example@example.test' });
});
it('does not accept a signed-in browser session instead of an explicit key', async () => {
  const response = await POST(request());
  expect(response.status).toBe(401);
  expect((await response.json()).code).toBe('key_required');
  expect(mocks.principal).not.toHaveBeenCalled();
  expect(mocks.balance).not.toHaveBeenCalled();
});
it('rejects invalid or expired credentials without session fallback', async () => {
  mocks.principal.mockResolvedValue(null);
  const response = await POST(request('Bearer er_invalid'));
  expect(response.status).toBe(401);
  expect(mocks.balance).not.toHaveBeenCalled();
});
it('does not reveal a different account through the signed-in browser', async () => {
  mocks.session.mockResolvedValue({ id: 'other' });
  const response = await POST(request('Bearer er_fixture'));
  expect(response.status).toBe(403);
  expect((await response.json()).code).toBe('account_mismatch');
  expect(mocks.account).not.toHaveBeenCalled();
});
it('requires read permission without reading the wallet', async () => {
  mocks.principal.mockResolvedValue({ ...principal, scopes: ['spend'] });
  const response = await POST(request('Bearer er_fixture'));
  expect(response.status).toBe(403);
  expect((await response.json()).code).toBe('insufficient_scope');
  expect(mocks.balance).not.toHaveBeenCalled();
});
it('returns only safe account and key metadata with no cache or credential echo', async () => {
  const response = await POST(request('Bearer er_fixture'));
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const body = await response.json();
  expect(body).toEqual({
    account: { name: 'Example', email: 'example@example.test' },
    balance: 75,
    key: {
      scopes: ['read', 'spend'],
      expiresAt: '2030-01-01T00:00:00.000Z',
      creditLimit: 100,
      spentCredits: 30,
      remainingCredits: 70,
    },
  });
  expect(JSON.stringify(body)).not.toContain('er_fixture');
  expect(JSON.stringify(body)).not.toContain('key-1');
});
it('supports explicit bearer verification without a browser session and preserves unlimited caps', async () => {
  mocks.session.mockResolvedValue(null);
  mocks.principal.mockResolvedValue({ ...principal, expiresAt: null, creditLimit: null });
  const response = await POST(request('Bearer er_fixture'));
  expect(response.status).toBe(200);
  expect((await response.json()).key).toMatchObject({
    expiresAt: null,
    creditLimit: null,
    remainingCredits: null,
  });
});
