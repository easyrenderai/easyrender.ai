import { db } from '@easyrender/db';
import { afterAll, describe, expect, it } from 'vitest';

// Runs against a real Postgres: set TEST_DATABASE_URL (a scratch database with the schema pushed).
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

const run = describe.skipIf(!url);

run('a render real size (real database)', () => {
  const load = async () => import('./render-size');
  const newUser = async () => {
    const id = `u_${Math.random().toString(36).slice(2)}`;
    await db().user.create({ data: { id, name: 'T', email: `${id}@example.com`, credits: 0 } });
    return id;
  };
  const newRender = async (userId: string) =>
    (await db().render.create({ data: { userId, sourceKey: 'fake:photo.jpg' } })).id;

  afterAll(async () => {
    await db().$disconnect();
  });

  it('is saved by the owner and read back, then removed', async () => {
    const { getRenderSize, saveRenderSize } = await load();
    const userId = await newUser();
    const id = await newRender(userId);
    const actor = { userId };
    expect((await getRenderSize(id, actor)).size).toBeNull();

    const saved = await saveRenderSize(id, actor, { widthCm: 70, heightCm: 77.04 });
    expect(saved.size).toEqual({ widthCm: 70, heightCm: 77 });
    expect((await getRenderSize(id, actor)).size).toEqual({ widthCm: 70, heightCm: 77 });
    const stored = await db().render.findUniqueOrThrow({ where: { id } });
    expect(stored.sizeCm).toEqual({ widthCm: 70, heightCm: 77 });

    expect((await saveRenderSize(id, actor, null)).size).toBeNull();
    expect((await db().render.findUniqueOrThrow({ where: { id } })).sizeCm).toBeNull();
  });

  it('moves the model version, so a viewer loads the model again', async () => {
    const { saveRenderSize } = await load();
    const userId = await newUser();
    const id = await newRender(userId);
    const before = (await db().render.findUniqueOrThrow({ where: { id } })).updatedAt.getTime();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const saved = await saveRenderSize(id, { userId }, { heightCm: 90 });
    expect(saved.version).toBeGreaterThan(before);
  });

  it('refuses a size that is not one, and anyone but the owner', async () => {
    const { saveRenderSize } = await load();
    const userId = await newUser();
    const id = await newRender(userId);
    await expect(saveRenderSize(id, { userId }, { heightCm: 0 })).rejects.toMatchObject({
      status: 400,
      code: 'bad_body',
    });
    await expect(saveRenderSize(id, { userId }, 'tall')).rejects.toMatchObject({ status: 400 });
    const other = await newUser();
    await expect(saveRenderSize(id, { userId: other }, { heightCm: 90 })).rejects.toMatchObject({
      status: 404,
    });
    expect((await db().render.findUniqueOrThrow({ where: { id } })).sizeCm).toBeNull();
  });
});
