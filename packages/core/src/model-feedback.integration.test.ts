import { db } from '@easyrender/db';
import { afterAll, describe, expect, it } from 'vitest';
import { hasModelFeedback, saveModelFeedback } from './model-feedback';

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

describe.skipIf(!url)('model feedback (real database)', () => {
  const users: string[] = [];
  async function fixture(isReady = true) {
    const userId = `feedback_${crypto.randomUUID()}`;
    users.push(userId);
    await db().user.create({
      data: { id: userId, name: 'Feedback fixture', email: `${userId}@example.invalid` },
    });
    const render = await db().render.create({
      data: {
        userId,
        sourceKey: 'fixture:photo',
        status: isReady ? 'ready' : 'rendering',
        glbKey: isReady ? 'fixture:model.glb' : null,
        isPublic: true,
      },
    });
    return { id: render.id, actor: { userId } };
  }
  afterAll(async () => {
    await db().render.deleteMany({ where: { userId: { in: users } } });
    await db().user.deleteMany({ where: { id: { in: users } } });
    await db().$disconnect();
  });
  it('stores the owner response once and reads back its state without exposing the comment', async () => {
    const { id, actor } = await fixture();
    expect(await hasModelFeedback(id, actor)).toBe(false);
    expect(
      await saveModelFeedback(id, actor, {
        rating: 2,
        reasons: ['shape'],
        comment: '  Missing handle  ',
      }),
    ).toEqual({ recorded: true });
    expect(await hasModelFeedback(id, actor)).toBe(true);
    expect(await db().modelFeedback.findUnique({ where: { renderId: id } })).toMatchObject({
      rating: 2,
      reasons: ['shape'],
      comment: 'Missing handle',
    });
    await expect(saveModelFeedback(id, actor, { rating: 5 })).rejects.toMatchObject({
      status: 409,
      code: 'feedback_exists',
    });
  });
  it('remembers dismissal across visits and does not accept a later response', async () => {
    const { id, actor } = await fixture();
    await saveModelFeedback(id, actor, { dismissed: true });
    expect(await hasModelFeedback(id, actor)).toBe(true);
    expect(await db().modelFeedback.findUnique({ where: { renderId: id } })).toMatchObject({
      rating: null,
      reasons: [],
      comment: null,
    });
    await expect(saveModelFeedback(id, actor, { rating: 5 })).rejects.toMatchObject({
      status: 409,
    });
  });
  it('allows only one winner under concurrent submissions', async () => {
    const { id, actor } = await fixture();
    const results = await Promise.allSettled(
      [1, 2, 3, 4, 5].map((rating) => saveModelFeedback(id, actor, { rating })),
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    for (const result of results) {
      if (result.status === 'rejected') expect(result.reason).toMatchObject({ status: 409 });
    }
    expect(await db().modelFeedback.count({ where: { renderId: id } })).toBe(1);
  });
  it('denies anonymous visitors, other users even on public models, missing and unfinished models', async () => {
    const { id, actor } = await fixture();
    const other = await fixture();
    for (const denied of [{ anonId: 'anon' }, other.actor]) {
      const status = 'userId' in denied ? 404 : 401;
      await expect(saveModelFeedback(id, denied, { rating: 5 })).rejects.toMatchObject({ status });
      await expect(hasModelFeedback(id, denied)).rejects.toMatchObject({ status });
    }
    await expect(saveModelFeedback('missing', actor, { rating: 5 })).rejects.toMatchObject({
      status: 404,
    });
    const pending = await fixture(false);
    await expect(saveModelFeedback(pending.id, pending.actor, { rating: 5 })).rejects.toMatchObject(
      { status: 409, code: 'model_not_ready' },
    );
    await expect(saveModelFeedback(id, actor, { rating: 0 })).rejects.toMatchObject({
      status: 400,
    });
    expect(await hasModelFeedback(id, actor)).toBe(false);
  });
});
