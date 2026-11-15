import { db } from '@easyrender/db';
import { ENLARGE_MODEL, UPSCALE_CREDITS } from '@easyrender/harness';
import sharp from 'sharp';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Runs against a real Postgres: set TEST_DATABASE_URL (a scratch database with the schema pushed).
// Replicate and storage are faked with real pictures; the charge, the refund and the database
// transitions are the real code.
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

const fake = vi.hoisted(() => ({
  files: new Map<string, Uint8Array>(),
  outputs: new Map<string, Uint8Array>(),
  statuses: new Map<string, string>(),
  starts: [] as { path: string; body: { input?: Record<string, unknown> } }[],
  uploads: [] as { bytes: Uint8Array; type: string }[],
  next: [] as string[],
  larger: new Uint8Array(),
  hasDownloadFailure: false,
}));

vi.mock('@easyrender/harness', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@easyrender/harness')>()),
  download: async (url: string) => {
    if (fake.hasDownloadFailure) throw new Error('temporary download outage');
    return fake.outputs.get(url) ?? new Uint8Array();
  },
  createReplicate: () => ({
    upload: async (bytes: Uint8Array, _name: string, type: string) => {
      fake.uploads.push({ bytes, type });
      return `https://replicate.test/file/${fake.uploads.length}`;
    },
    start: async (path: string, body: { input?: Record<string, unknown> }) => {
      fake.starts.push({ path, body });
      const id = `pred_${crypto.randomUUID()}`;
      const status = fake.next.shift() ?? 'succeeded';
      fake.statuses.set(id, status);
      if (status === 'succeeded') fake.outputs.set(`https://replicate.test/out/${id}`, fake.larger);
      return { id };
    },
    get: async (id: string) => ({
      id,
      status: fake.statuses.get(id) ?? 'failed',
      output: `https://replicate.test/out/${id}`,
      error: fake.statuses.get(id) === 'failed' ? 'model error' : null,
    }),
  }),
}));

vi.mock('./storage', () => ({
  getFile: async (key: string) => fake.files.get(key) ?? new Uint8Array(),
  putFile: async (path: string, bytes: Uint8Array) => {
    const key = `fake:${path}:${fake.files.size}`;
    fake.files.set(key, bytes);
    return key;
  },
}));

const flat = async (width: number, height: number, format: 'jpeg' | 'png' = 'jpeg') =>
  new Uint8Array(
    await sharp({ create: { width, height, channels: 3, background: '#a05a28' } })
      [format]()
      .toBuffer(),
  );

describe.skipIf(!url)('upscale (needs TEST_DATABASE_URL)', () => {
  const load = () => import('./upscale');
  const newUser = async (credits: number) => {
    const id = `u_${Math.random().toString(36).slice(2)}`;
    await db().user.create({ data: { id, name: 'T', email: `${id}@example.com`, credits } });
    return id;
  };
  const balance = async (id: string) =>
    (await db().user.findUniqueOrThrow({ where: { id } })).credits;

  // A finished set with one ready view whose picture is `side` px square.
  const readyView = async (userId: string, side = 2000) => {
    const key = `fake:view:${Math.random()}`;
    fake.files.set(key, await flat(side, side));
    const set = await db().viewSet.create({
      data: { userId, sourceKey: 'src', status: 'ready', name: 'Armchair' },
    });
    await db().productView.create({
      data: { setId: set.id, view: 'front', status: 'ready', key, rawKey: key },
    });
    return { set, key };
  };

  beforeEach(async () => {
    fake.hasDownloadFailure = false;
    fake.files.clear();
    fake.outputs.clear();
    fake.statuses.clear();
    fake.starts.length = 0;
    fake.uploads.length = 0;
    fake.next = [];
    fake.larger = await flat(4000, 4000, 'png');
    process.env.REPLICATE_API_TOKEN = 'test';
  });

  afterAll(async () => {
    await db().$disconnect();
  });

  it('reserves one charge and provider job for simultaneous requests for the same picture', async () => {
    const { startUpscale } = await load();
    const userId = await newUser(UPSCALE_CREDITS * 5);
    const { set } = await readyView(userId);
    const rows = await Promise.all(
      Array.from({ length: 4 }, () =>
        startUpscale({ kind: 'view', viewSetId: set.id, view: 'front' }, { userId }),
      ),
    );
    expect(new Set(rows.map((row) => row.id)).size).toBe(1);
    expect(await balance(userId)).toBe(UPSCALE_CREDITS * 4);
    expect(fake.starts).toHaveLength(1);
  });

  it('retains the paid prediction when downloading a finished image fails temporarily', async () => {
    const { startUpscale, getUpscale } = await load();
    const userId = await newUser(UPSCALE_CREDITS);
    const { set } = await readyView(userId);
    const row = await startUpscale({ kind: 'view', viewSetId: set.id, view: 'front' }, { userId });
    fake.hasDownloadFailure = true;
    expect((await getUpscale(row.id, { userId })).status).toBe('processing');
    expect((await db().upscale.findUniqueOrThrow({ where: { id: row.id } })).predictionId).toBe(
      row.predictionId,
    );
    expect(await balance(userId)).toBe(0);
    fake.hasDownloadFailure = false;
    expect((await getUpscale(row.id, { userId })).status).toBe('ready');
  });

  it('rolls back a terminal failure when its refund cannot be credited and retries safely', async () => {
    const { startUpscale, getUpscale } = await load();
    const userId = await newUser(UPSCALE_CREDITS);
    const { set } = await readyView(userId);
    fake.next = ['failed'];
    const row = await startUpscale({ kind: 'view', viewSetId: set.id, view: 'front' }, { userId });
    await db().user.update({ where: { id: userId }, data: { credits: 2_147_483_647 } });
    await getUpscale(row.id, { userId }).catch(() => undefined);
    expect((await db().upscale.findUniqueOrThrow({ where: { id: row.id } })).status).toBe(
      'processing',
    );
    await db().user.update({ where: { id: userId }, data: { credits: 0 } });
    expect((await getUpscale(row.id, { userId })).status).toBe('failed');
    expect(await balance(userId)).toBe(UPSCALE_CREDITS);
  });

  it('charges once, sends the picture to the upscaler and stores a larger JPEG', async () => {
    const { startUpscale, getUpscale, getUpscaleImage } = await load();
    const userId = await newUser(UPSCALE_CREDITS + 5);
    const { set } = await readyView(userId);

    const started = await startUpscale(
      { kind: 'view', viewSetId: set.id, view: 'front' },
      { userId },
    );
    expect(started.status).toBe('processing');
    expect(await balance(userId)).toBe(5);
    expect(fake.starts[0]?.path).toBe(ENLARGE_MODEL.path);
    expect(fake.uploads[0]?.type).toBe('image/jpeg');

    const done = await getUpscale(started.id, { userId });
    expect(done.status).toBe('ready');
    expect([done.width, done.height]).toEqual([4000, 4000]);
    const image = await getUpscaleImage(started.id, { userId });
    expect((await sharp(image.bytes).metadata()).format).toBe('jpeg');
    expect(image.filename).toBe('easyrender-view-front-4000px.jpg');

    // Asking again for the same picture returns the same enlargement and charges nothing.
    const again = await startUpscale(
      { kind: 'view', viewSetId: set.id, view: 'front' },
      { userId },
    );
    expect(again.id).toBe(started.id);
    expect(await balance(userId)).toBe(5);
    expect(fake.starts).toHaveLength(1);
  });

  it('refunds when the upscaler gives nothing back', async () => {
    const { startUpscale, getUpscale } = await load();
    const userId = await newUser(UPSCALE_CREDITS);
    const { set } = await readyView(userId);
    fake.next = ['failed'];

    const started = await startUpscale(
      { kind: 'view', viewSetId: set.id, view: 'front' },
      { userId },
    );
    expect(await balance(userId)).toBe(0);
    const failed = await getUpscale(started.id, { userId });
    expect(failed.status).toBe('failed');
    expect(await balance(userId)).toBe(UPSCALE_CREDITS);
    // Reading it again never refunds twice.
    await getUpscale(started.id, { userId });
    expect(await balance(userId)).toBe(UPSCALE_CREDITS);
  });

  it('does not charge when there are not enough credits, or the picture is already large', async () => {
    const { startUpscale } = await load();
    const poor = await newUser(UPSCALE_CREDITS - 1);
    const { set } = await readyView(poor);
    await expect(
      startUpscale({ kind: 'view', viewSetId: set.id, view: 'front' }, { userId: poor }),
    ).rejects.toMatchObject({ status: 402 });
    expect(await balance(poor)).toBe(UPSCALE_CREDITS - 1);
    expect(await db().upscale.count({ where: { userId: poor } })).toBe(0);

    const rich = await newUser(50);
    const big = await readyView(rich, 3000);
    await expect(
      startUpscale({ kind: 'view', viewSetId: big.set.id, view: 'front' }, { userId: rich }),
    ).rejects.toMatchObject({ code: 'already_large' });
    expect(await balance(rich)).toBe(50);
  });

  it('keeps other owners out and needs a signed-in actor', async () => {
    const { startUpscale, getUpscale, listUpscales } = await load();
    const owner = await newUser(50);
    const other = await newUser(50);
    const { set } = await readyView(owner);
    const target = { kind: 'view', viewSetId: set.id, view: 'front' } as const;

    await expect(startUpscale(target, { userId: other })).rejects.toMatchObject({ status: 404 });
    await expect(startUpscale(target, {})).rejects.toMatchObject({ status: 401 });
    const started = await startUpscale(target, { userId: owner });
    await expect(getUpscale(started.id, { userId: other })).rejects.toMatchObject({ status: 404 });
    expect(await listUpscales({ userId: other }, { viewSetId: set.id })).toHaveLength(0);
    expect(await balance(other)).toBe(50);
  });

  it('enlarges the sheet of a paid render only, and hides an enlargement of a replaced picture', async () => {
    const { startUpscale, listUpscales } = await load();
    const userId = await newUser(50);
    fake.files.set('sheet-1', await flat(2048, 2048, 'png'));
    const preview = await db().render.create({
      data: { userId, sourceKey: 'src', sheetKey: 'sheet-1', status: 'preview_ready' },
    });
    await expect(
      startUpscale({ kind: 'sheet', renderId: preview.id }, { userId }),
    ).rejects.toMatchObject({ status: 409 });

    const paid = await db().render.create({
      data: { userId, sourceKey: 'src', sheetKey: 'sheet-1', status: 'ready' },
    });
    const row = await startUpscale({ kind: 'sheet', renderId: paid.id }, { userId });
    expect((await listUpscales({ userId }, { renderId: paid.id })).map((r) => r.id)).toEqual([
      row.id,
    ]);
    // The sheet is redrawn: the old enlargement is of a picture that is gone.
    fake.files.set('sheet-2', await flat(2048, 2048, 'png'));
    await db().render.update({ where: { id: paid.id }, data: { sheetKey: 'sheet-2' } });
    expect(await listUpscales({ userId }, { renderId: paid.id })).toHaveLength(0);
  });
});
