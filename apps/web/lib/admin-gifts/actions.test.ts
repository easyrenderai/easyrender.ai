import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  admin: { id: 'admin-1', email: 'admin@example.test' } as { id: string; email: string } | null,
  credits: 40,
  keys: new Set<string>(),
  grants: [] as Array<{ userId: string; amount: number; key: string; reason: string }>,
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/admin-analytics/auth', () => ({
  requireAdmin: async () => {
    if (!state.admin) throw new Error('NEXT_HTTP_ERROR_FALLBACK;404');
    return state.admin;
  },
}));
vi.mock('@easyrender/db', () => ({
  db: () => ({
    user: {
      findUnique: async ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.email !== 'user@example.test' && where.id !== 'user-1') return null;
        return {
          id: 'user-1',
          email: 'user@example.test',
          name: 'Recipient',
          credits: state.credits,
        };
      },
    },
    creditLedger: {
      findMany: async () => [
        { id: 'entry-1', delta: 40, reason: 'signup', createdAt: new Date('2026-11-01T10:00:00Z') },
      ],
    },
  }),
}));
vi.mock('@easyrender/core', () => ({
  grantCredits: async (input: { userId: string; amount: number; key: string; reason: string }) => {
    if (state.keys.has(input.key)) return false;
    state.keys.add(input.key);
    state.credits += input.amount;
    state.grants.push(input);
    return true;
  },
}));

import { findGiftRecipient, giftCredits } from './actions';

const key = '61e709c0-00d9-4a88-8773-c2f33e2744f3';
const valid = { email: 'user@example.test', amount: 25, reason: 'Customer support', key };

beforeEach(() => {
  state.admin = { id: 'admin-1', email: 'admin@example.test' };
  state.credits = 40;
  state.keys.clear();
  state.grants.length = 0;
});

describe('admin gift credits actions', () => {
  it('rejects non-admin lookup and grant before reading or writing data', async () => {
    state.admin = null;
    await expect(findGiftRecipient('user@example.test')).rejects.toThrow();
    await expect(giftCredits(valid)).rejects.toThrow();
    expect(state.grants).toHaveLength(0);
  });

  it.each(['', 'not-an-email', 'a'.repeat(255)])('rejects invalid email %s', async (email) => {
    expect(await findGiftRecipient(email)).toMatchObject({ status: 'invalid_email' });
    expect(await giftCredits({ ...valid, email })).toMatchObject({ status: 'invalid_email' });
    expect(state.grants).toHaveLength(0);
  });

  it('rejects a missing email', async () => {
    expect(await findGiftRecipient(undefined as unknown as string)).toMatchObject({
      status: 'invalid_email',
    });
    expect(await giftCredits({ ...valid, email: undefined as unknown as string })).toMatchObject({
      status: 'invalid_email',
    });
    expect(state.grants).toHaveLength(0);
  });

  it.each([0, -1, 1.5, 10001, Number.NaN])('rejects invalid amount %s', async (amount) => {
    expect(await giftCredits({ ...valid, amount })).toMatchObject({ status: 'invalid_amount' });
    expect(state.grants).toHaveLength(0);
  });

  it('requires a reason and valid submission key', async () => {
    expect(await giftCredits({ ...valid, reason: '  ' })).toMatchObject({
      status: 'invalid_reason',
    });
    expect(await giftCredits({ ...valid, key: '' })).toMatchObject({ status: 'invalid_key' });
    expect(state.grants).toHaveLength(0);
  });

  it('reports missing users clearly', async () => {
    expect(await findGiftRecipient('missing@example.test')).toMatchObject({ status: 'not_found' });
    expect(await giftCredits({ ...valid, email: 'missing@example.test' })).toMatchObject({
      status: 'not_found',
    });
  });

  it('shows the balance and recent ledger entries', async () => {
    expect(await findGiftRecipient(' USER@example.test ')).toMatchObject({
      status: 'found',
      recipient: { id: 'user-1', email: 'user@example.test', credits: 40 },
      ledger: [{ id: 'entry-1', delta: 40, reason: 'signup' }],
    });
  });

  it('grants once with the admin attribution and returns the current balance on retry', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      expect(await giftCredits(valid)).toMatchObject({
        status: 'granted',
        recipient: { credits: 65 },
      });
      expect(await giftCredits(valid)).toMatchObject({
        status: 'duplicate',
        recipient: { credits: 65 },
      });
      expect(state.grants).toHaveLength(1);
      expect(state.grants[0]).toMatchObject({
        userId: 'user-1',
        amount: 25,
        key: `admin-gift:${key}`,
        reason: 'admin_gift:admin-1:Customer support',
      });
      expect(log).toHaveBeenCalledWith('admin_credit_gift', {
        adminId: 'admin-1',
        adminEmail: 'admin@example.test',
        targetUserId: 'user-1',
        targetEmail: 'user@example.test',
        amount: 25,
        key: `admin-gift:${key}`,
        reason: 'admin_gift:admin-1:Customer support',
      });
    } finally {
      log.mockRestore();
    }
  });
});
