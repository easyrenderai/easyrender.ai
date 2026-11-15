import { randomUUID } from 'node:crypto';
import { db } from '@easyrender/db';
import { afterAll, describe, expect, it } from 'vitest';
import { createApiKey } from './api-keys';
import { spendCredits } from './credits';

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;
describe.skipIf(!url)('API key spending boundary', () => {
  afterAll(async () => {
    await db().$disconnect();
  });
  async function setup(scopes: ('read' | 'write' | 'spend' | 'share')[] = ['spend']) {
    const id = `budget-${randomUUID()}`;
    await db().user.create({ data: { id, name: 'Test', email: `${id}@example.com`, credits: 20 } });
    return { userId: id, apiKey: await createApiKey(id, 'test', { scopes, creditLimit: 5 }) };
  }
  it('cannot exceed a key budget when paid requests race', async () => {
    const { userId, apiKey } = await setup();
    const results = await Promise.allSettled(
      Array.from({ length: 2 }, () =>
        spendCredits({ userId, apiKeyId: apiKey.id, amount: 4, key: randomUUID(), reason: 'test' }),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await db().user.findUniqueOrThrow({ where: { id: userId } })).credits).toBe(16);
    expect((await db().apiKey.findUniqueOrThrow({ where: { id: apiKey.id } })).spentCredits).toBe(
      4,
    );
  });
  it('cannot spend with a read-only key even if the caller bypasses the HTTP guard', async () => {
    const { userId, apiKey } = await setup(['read']);
    await expect(
      spendCredits({ userId, apiKeyId: apiKey.id, amount: 1, key: randomUUID(), reason: 'test' }),
    ).rejects.toMatchObject({ status: 403 });
    expect((await db().user.findUniqueOrThrow({ where: { id: userId } })).credits).toBe(20);
  });
  it('counts the same debit once and rejects revoked keys', async () => {
    const { userId, apiKey } = await setup();
    const input = { userId, apiKeyId: apiKey.id, amount: 3, key: randomUUID(), reason: 'test' };
    await spendCredits(input);
    await spendCredits(input);
    expect((await db().apiKey.findUniqueOrThrow({ where: { id: apiKey.id } })).spentCredits).toBe(
      3,
    );
    await db().apiKey.delete({ where: { id: apiKey.id } });
    await expect(spendCredits({ ...input, key: randomUUID() })).rejects.toMatchObject({
      status: 403,
    });
  });
});
