import { db } from '@easyrender/db';
import {
  BUILD_MODEL,
  BUILD_MODEL_2,
  BUILD_QUALITY_CREDITS,
  RENDER_CREDITS,
  SHEET_CREDITS,
} from '@easyrender/harness';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Runs against a real Postgres: set TEST_DATABASE_URL (a scratch database with the schema pushed).
// Replicate and storage are faked; everything else, including transactions, is the real code.
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

const replicate = vi.hoisted(() => ({
  start: vi.fn(),
  upload: vi.fn(),
  get: vi.fn(),
  download: vi.fn(),
  checkSheet: vi.fn(),
}));

vi.mock('@easyrender/harness', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@easyrender/harness')>()),
  download: async (...args: unknown[]) => replicate.download(...args),
  checkSheet: async (...args: unknown[]) => replicate.checkSheet(...args),
  cutCells: async () => Array.from({ length: 9 }, () => new Uint8Array([1])),
  createReplicate: () => ({
    upload: async (...args: unknown[]) => replicate.upload(...args),
    start: replicate.start,
    get: replicate.get,
  }),
}));

vi.mock('./storage', () => ({
  getFile: async () => new Uint8Array([1, 2, 3]),
  putFile: async (path: string) => `fake:${path}`,
}));

const run = describe.skipIf(!url);
const MEDIUM = BUILD_QUALITY_CREDITS.medium;
const HIGH = BUILD_QUALITY_CREDITS.high;

run('build quality (real database)', () => {
  const load = () => import('./renders');
  const newUser = async (credits: number) => {
    const id = `u_${Math.random().toString(36).slice(2)}`;
    await db().user.create({ data: { id, name: 'T', email: `${id}@example.com`, credits } });
    return id;
  };
  const balance = async (id: string) =>
    (await db().user.findUniqueOrThrow({ where: { id } })).credits;
  const newRender = (userId: string, data: Record<string, unknown> = {}) =>
    db().render.create({
      data: {
        userId,
        sourceKey: 'fake:source.jpg',
        sheetKey: 'fake:sheets/draft.png',
        status: 'preview_ready',
        ...data,
      },
    });
  const reload = (id: string) => db().render.findUniqueOrThrow({ where: { id } });
  // A finished High or Medium model that its owner paid for in full.
  const built = (userId: string, quality: 'medium' | 'high') =>
    newRender(userId, {
      status: 'ready',
      glbKey: 'fake:models/model.glb',
      credits: BUILD_QUALITY_CREDITS[quality],
      buildQuality: quality,
      buildPredictionId: `done_${userId}`,
    });

  beforeEach(() => {
    replicate.upload.mockReset().mockResolvedValue('https://replicate.test/file');
    replicate.start.mockReset().mockImplementation(async () => ({ id: `pred_${Math.random()}` }));
    replicate.get.mockReset();
    replicate.download.mockReset().mockResolvedValue(new Uint8Array([9, 9, 9]));
    replicate.checkSheet.mockReset().mockResolvedValue({ ok: true, warnings: [], measures: {} });
    process.env.REPLICATE_API_TOKEN = 'test';
  });

  afterAll(async () => {
    await db().$disconnect();
  });

  it('builds with no quality exactly as before: the standard model on the photo and the sheet', async () => {
    const renders = await load();
    const userId = await newUser(RENDER_CREDITS);
    const render = await newRender(userId);
    await renders.startBuild(render.id, { userId });
    const [path, body] = replicate.start.mock.calls[0] ?? [];
    expect(path).toBe('/predictions');
    expect(body.version).toBe(BUILD_MODEL.version);
    expect(body.input.images).toHaveLength(10);
    expect(body.input).not.toHaveProperty('image');
    const after = await reload(render.id);
    expect(after.buildQuality).toBeNull();
    expect(after.credits).toBe(RENDER_CREDITS);
    expect(await balance(userId)).toBe(0);
  });

  it.each([
    ['medium', MEDIUM, '1024_cascade'],
    ['high', HIGH, '1536_cascade'],
  ] as const)(
    'charges the %s price and builds on TRELLIS.2 from the photo alone',
    async (quality, price, pipeline) => {
      const renders = await load();
      const userId = await newUser(price + 5);
      const render = await newRender(userId);
      await renders.startBuild(render.id, { userId }, quality);
      expect(replicate.start).toHaveBeenCalledTimes(1);
      const body = replicate.start.mock.calls[0]?.[1];
      expect(body.version).toBe(BUILD_MODEL_2.version);
      expect(body.input).toMatchObject({
        pipeline_type: pipeline,
        image: 'https://replicate.test/file',
      });
      expect(body.input).not.toHaveProperty('images');
      // The sheet is not read or sent: only the photo was uploaded.
      expect(replicate.upload).toHaveBeenCalledTimes(1);
      const after = await reload(render.id);
      expect(after.status).toBe('rendering');
      expect(after.buildQuality).toBe(quality);
      expect(after.credits).toBe(price);
      expect(await balance(userId)).toBe(5);
      const ledger = await db().creditLedger.findMany({ where: { renderId: render.id } });
      expect(ledger.map((row) => row.delta)).toEqual([-price]);
    },
  );

  it('counts a paid angle sheet toward the higher price', async () => {
    const renders = await load();
    const userId = await newUser(HIGH);
    const render = await newRender(userId, { credits: SHEET_CREDITS });
    await renders.startBuild(render.id, { userId }, 'high');
    expect(await balance(userId)).toBe(SHEET_CREDITS);
    expect((await reload(render.id)).credits).toBe(HIGH);
  });

  it('refuses a higher quality without enough credits and charges nothing', async () => {
    const renders = await load();
    const userId = await newUser(RENDER_CREDITS);
    const render = await newRender(userId);
    await expect(renders.startBuild(render.id, { userId }, 'high')).rejects.toMatchObject({
      status: 402,
    });
    expect(await balance(userId)).toBe(RENDER_CREDITS);
    expect((await reload(render.id)).status).toBe('preview_ready');
    expect(replicate.start).not.toHaveBeenCalled();
  });

  it('keeps the authorized ceiling per quality', async () => {
    const renders = await load();
    const userId = await newUser(HIGH);
    const render = await newRender(userId);
    await expect(
      renders.startBuild(render.id, { userId, maxCredits: HIGH - 1 }, 'high'),
    ).rejects.toMatchObject({ code: 'budget_exceeded' });
    expect(await balance(userId)).toBe(HIGH);
  });

  it('keeps the free model at Low quality', async () => {
    const renders = await load();
    const userId = await newUser(0);
    const render = await newRender(userId);
    await expect(
      renders.startBuild(render.id, { userId, isUsingFreeModel: true }, 'medium'),
    ).rejects.toMatchObject({ code: 'bad_quality' });
  });

  it('refunds the full amount when the provider rejects a High build', async () => {
    const renders = await load();
    const userId = await newUser(HIGH);
    const render = await newRender(userId);
    replicate.start.mockRejectedValue(
      Object.assign(new Error('rejected'), { name: 'ProviderRequestError', status: 422 }),
    );
    await expect(renders.startBuild(render.id, { userId }, 'high')).rejects.toBeDefined();
    expect(await balance(userId)).toBe(HIGH);
    expect((await reload(render.id)).status).toBe('failed');
  });

  it('refunds the full amount when a Medium build fails at the provider', async () => {
    const renders = await load();
    const userId = await newUser(MEDIUM);
    const render = await newRender(userId);
    await renders.startBuild(render.id, { userId }, 'medium');
    replicate.get.mockResolvedValue({ status: 'failed', error: 'boom' });
    await renders.advance(render.id);
    expect(await balance(userId)).toBe(MEDIUM);
    await renders.advance(render.id);
    expect(await balance(userId)).toBe(MEDIUM);
  });

  it('shows what each quality costs and the refund a rebuild would give', async () => {
    const renders = await load();
    const userId = await newUser(0);
    const render = await built(userId, 'high');
    const view = renders.toView(render);
    expect(view.buildQuality).toBe('high');
    expect(view.qualityCredits).toEqual(BUILD_QUALITY_CREDITS);
    expect(view.rebuildRefundCredits).toBe(HIGH - RENDER_CREDITS);
    const standard = await newRender(userId, { status: 'ready', credits: RENDER_CREDITS });
    expect(renders.toView(standard).buildQuality).toBe('low');
    expect(renders.toView(standard).rebuildRefundCredits).toBe(0);
  });

  describe('rebuild in Standard', () => {
    it('returns the difference once and builds the standard model on the sheet', async () => {
      const renders = await load();
      const userId = await newUser(0);
      const render = await built(userId, 'high');
      const after = await renders.rebuildStandard(render.id, { userId });
      expect(after.status).toBe('rendering');
      expect(await balance(userId)).toBe(HIGH - RENDER_CREDITS);
      const stored = await reload(render.id);
      expect(stored.buildQuality).toBeNull();
      expect(stored.credits).toBe(RENDER_CREDITS);
      expect(stored.buildPredictionId).toMatch(/^pred_/);
      const body = replicate.start.mock.calls[0]?.[1];
      expect(body.version).toBe(BUILD_MODEL.version);
      expect(body.input.images).toHaveLength(10);
      const ledger = await db().creditLedger.findMany({ where: { renderId: render.id } });
      expect(ledger).toHaveLength(1);
      expect(ledger[0]).toMatchObject({
        delta: HIGH - RENDER_CREDITS,
        reason: 'build_quality_refund',
        idempotencyKey: `rebuild-refund:${render.id}`,
      });
      const edits = await db().renderEdit.findMany({ where: { renderId: render.id } });
      expect(edits.map((edit) => edit.kind)).toEqual(['rebuild_standard']);
    });

    it('refunds once when two requests arrive together', async () => {
      const renders = await load();
      const userId = await newUser(0);
      const render = await built(userId, 'high');
      const results = await Promise.allSettled([
        renders.rebuildStandard(render.id, { userId }),
        renders.rebuildStandard(render.id, { userId }),
        renders.rebuildStandard(render.id, { userId }),
      ]);
      expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
      expect(await balance(userId)).toBe(HIGH - RENDER_CREDITS);
      expect(
        await db().creditLedger.count({ where: { idempotencyKey: `rebuild-refund:${render.id}` } }),
      ).toBe(1);
      expect(replicate.start).toHaveBeenCalledTimes(1);
      // Asking again once it is building, or done, gives nothing more.
      await renders.rebuildStandard(render.id, { userId });
      expect(await balance(userId)).toBe(HIGH - RENDER_CREDITS);
    });

    it('does not refund a second time after the rebuilt model is ready', async () => {
      const renders = await load();
      const userId = await newUser(0);
      const render = await built(userId, 'medium');
      await renders.rebuildStandard(render.id, { userId });
      const glb = new Uint8Array(30_000);
      const view = new DataView(glb.buffer);
      view.setUint32(0, 0x46546c67, true);
      view.setUint32(4, 2, true);
      view.setUint32(8, glb.byteLength, true);
      replicate.download.mockResolvedValue(glb);
      replicate.get.mockResolvedValue({ status: 'succeeded', output: 'https://x.test/model.glb' });
      expect((await renders.advance(render.id))?.status).toBe('ready');
      const again = await renders.rebuildStandard(render.id, { userId });
      expect(again.status).toBe('ready');
      expect(await balance(userId)).toBe(MEDIUM - RENDER_CREDITS);
      expect(replicate.start).toHaveBeenCalledTimes(1);
    });

    it('hands back the whole price if the rebuild itself fails', async () => {
      const renders = await load();
      const userId = await newUser(0);
      const render = await built(userId, 'high');
      await renders.rebuildStandard(render.id, { userId });
      replicate.get.mockResolvedValue({ status: 'failed', error: 'boom' });
      await renders.advance(render.id);
      expect((await reload(render.id)).status).toBe('failed');
      expect(await balance(userId)).toBe(HIGH);
    });

    it('only works on your own Medium or High model', async () => {
      const renders = await load();
      const userId = await newUser(0);
      const render = await built(userId, 'high');
      await expect(
        renders.rebuildStandard(render.id, { userId: 'someone-else' }),
      ).rejects.toMatchObject({ status: 404 });
      const standard = await newRender(userId, {
        status: 'preview_ready',
        credits: 0,
      });
      await expect(renders.rebuildStandard(standard.id, { userId })).rejects.toMatchObject({
        status: 409,
      });
      expect(await balance(userId)).toBe(0);
      expect(replicate.start).not.toHaveBeenCalled();
    });
  });
});
