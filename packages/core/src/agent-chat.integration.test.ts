import { db } from '@easyrender/db';
import { afterAll, describe, expect, it } from 'vitest';

// Runs against a real Postgres: set TEST_DATABASE_URL (a scratch database with the schema pushed).
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

const run = describe.skipIf(!url);

run('agent chats (real database)', () => {
  const load = async () => ({
    chat: await import('./agent-chat'),
    credits: await import('./credits'),
  });
  const newUser = async (credits = 0) => {
    const id = `u_${Math.random().toString(36).slice(2)}`;
    await db().user.create({ data: { id, name: 'T', email: `${id}@example.com`, credits } });
    return id;
  };

  afterAll(async () => {
    await db().$disconnect();
  });

  it('stores a chat, titles it from the first message and reads it back in order', async () => {
    const { chat } = await load();
    const userId = await newUser();
    const created = await chat.createAgentChat(userId);
    await chat.appendAgentMessage(userId, created.id, {
      role: 'user',
      content: [{ type: 'text', text: 'Make a model of this chair' }],
      titleText: 'Make a model of this chair',
    });
    await chat.appendAgentMessage(userId, created.id, {
      role: 'assistant',
      content: [{ type: 'text', text: 'Starting the free preview.' }],
      credits: 1,
    });
    const read = await chat.getAgentChat(userId, created.id);
    expect(read.title).toBe('Make a model of this chair');
    expect(read.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(read.messages[1]?.credits).toBe(1);
    expect((await chat.listAgentChats(userId)).map((c) => c.id)).toEqual([created.id]);
  });

  it("answers 404 for someone else's chat and never lists it", async () => {
    const { chat } = await load();
    const owner = await newUser();
    const other = await newUser();
    const created = await chat.createAgentChat(owner);
    await expect(chat.getAgentChat(other, created.id)).rejects.toMatchObject({ status: 404 });
    await expect(
      chat.appendAgentMessage(other, created.id, { role: 'user', content: [] }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(chat.deleteAgentChat(other, created.id)).rejects.toMatchObject({ status: 404 });
    expect(await chat.listAgentChats(other)).toEqual([]);
  });

  it('carries the fraction of a credit and charges whole credits as it adds up', async () => {
    const { credits } = await load();
    const userId = await newUser(10);
    const charge = (n: number, micro: number) =>
      credits.chargeAgentTurn({ userId, key: `agent-turn:${userId}:${n}`, microCredits: micro });
    expect(await charge(1, 400_000)).toBe(0);
    expect(await charge(2, 400_000)).toBe(0);
    // 1.2 credits owed in all: one whole credit is charged, 0.2 stays.
    expect(await charge(3, 400_000)).toBe(1);
    const user = await db().user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.credits).toBe(9);
    expect(user.agentMicroCredits).toBe(200_000);
    const ledger = await db().creditLedger.findMany({ where: { userId } });
    expect(ledger.map((row) => [row.delta, row.reason])).toEqual([[-1, 'agent_chat']]);
  });

  it('never charges the same turn twice', async () => {
    const { credits } = await load();
    const userId = await newUser(10);
    const key = `agent-turn:${userId}:once`;
    expect(await credits.chargeAgentTurn({ userId, key, microCredits: 2_000_000 })).toBe(2);
    expect(await credits.chargeAgentTurn({ userId, key, microCredits: 2_000_000 })).toBe(0);
    const user = await db().user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.credits).toBe(8);
    expect(user.agentMicroCredits).toBe(0);
  });

  it('charges only what a short balance covers and does not carry a debt', async () => {
    const { credits } = await load();
    const userId = await newUser(1);
    expect(
      await credits.chargeAgentTurn({
        userId,
        key: `agent-turn:${userId}:a`,
        microCredits: 3_500_000,
      }),
    ).toBe(1);
    const user = await db().user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.credits).toBe(0);
    expect(user.agentMicroCredits).toBe(500_000);
  });
});
