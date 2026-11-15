import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
}));
vi.mock('@easyrender/db', () => ({ db: () => ({ apiKey: state }), Prisma: {} }));

import { verifyApiKey, verifyApiKeyPrincipal } from './api-keys';

const key = {
  id: 'key',
  userId: 'owner',
  resource: null,
  lastUsedAt: null,
  scopes: ['read', 'write', 'spend', 'share'],
  creditLimit: null,
  spentCredits: 0,
  expiresAt: null,
};
beforeEach(() => {
  vi.resetAllMocks();
});

describe('API key validation races', () => {
  it('returns unauthorized instead of 500 when revocation wins the timestamp write race', async () => {
    state.findUnique.mockResolvedValueOnce(key).mockResolvedValueOnce(null);
    state.updateMany.mockResolvedValue({ count: 0 });
    expect(await verifyApiKey('er_test')).toBeNull();
  });

  it('allows a key whose timestamp was refreshed by a concurrent request', async () => {
    state.findUnique.mockResolvedValue(key);
    state.updateMany.mockResolvedValue({ count: 0 });
    expect(await verifyApiKeyPrincipal('er_test')).toMatchObject({
      id: 'key',
      userId: 'owner',
      resource: null,
    });
  });

  it('rejects a credential bound to another service', async () => {
    state.findUnique.mockResolvedValue({ ...key, resource: 'https://another.example/api/mcp' });
    expect(await verifyApiKey('er_test')).toBeNull();
  });
});
