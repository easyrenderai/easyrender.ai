import { db } from '@easyrender/db';
import {
  BUILD_FROM_VIEWS_CREDITS,
  DEFAULT_HARNESS,
  ENLARGE_MODEL,
  PRODUCT_VIEWS_CREDITS,
  VIEW_POLISH_CREDITS,
  VIEWS,
} from '@easyrender/harness';
import sharp from 'sharp';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Runs against a real Postgres: set TEST_DATABASE_URL (a scratch database with the schema pushed).
// Replicate and storage are faked with real pictures, so the checks, the finishing and the
// database transitions are the real code; only the models' answers are scripted.
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

type Plan = { kind: 'sheet' | 'redraw' | 'upscale' | 'build'; status: string };
const fake = vi.hoisted(() => ({
  files: new Map<string, Uint8Array>(),
  outputs: new Map<string, Uint8Array>(),
  plans: new Map<string, Plan>(),
  starts: [] as { path: string; body: { input?: Record<string, unknown>; version?: string } }[],
  counter: 0,
  hasReadFailure: false,
  readGate: null as Promise<void> | null,
  onRead: null as (() => void) | null,
  hasDownloadFailure: false,
  downloadGate: null as Promise<void> | null,
  onDownload: null as (() => void) | null,
  startGate: null as Promise<void> | null,
  onStart: null as (() => void) | null,
  // What the next prediction of a kind answers with: 'succeeded' (default) or 'failed'.
  next: { sheet: [] as string[], redraw: [] as string[], upscale: [] as string[] },
  makeSheet: (() => new Uint8Array()) as () => Uint8Array,
  makeRedraw: (() => new Uint8Array()) as () => Uint8Array,
  makeUpscale: (() => new Uint8Array()) as () => Uint8Array,
}));

vi.mock('@easyrender/harness', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@easyrender/harness')>()),
  loadHarness: async () => DEFAULT_HARNESS,
  download: async (url: string) => {
    fake.onDownload?.();
    if (fake.downloadGate) await fake.downloadGate;
    if (fake.hasDownloadFailure) throw new Error('temporary image download outage');
    return fake.outputs.get(url) ?? new Uint8Array();
  },
  createReplicate: () => ({
    upload: async () => `https://replicate.test/file/${++fake.counter}`,
    start: async (path: string, body: { input?: Record<string, unknown>; version?: string }) => {
      fake.starts.push({ path, body });
      const id = `pred_${crypto.randomUUID()}`;
      const kind: Plan['kind'] = path.includes('nano-banana-2/')
        ? 'sheet'
        : path.includes('nano-banana-2-lite')
          ? 'redraw'
          : path === ENLARGE_MODEL.path
            ? 'upscale'
            : 'build';
      const queue = kind === 'build' ? [] : fake.next[kind];
      const status = queue.shift() ?? 'succeeded';
      fake.plans.set(id, { kind, status });
      if (status === 'succeeded' && kind !== 'build') {
        const bytes =
          kind === 'sheet'
            ? fake.makeSheet()
            : kind === 'redraw'
              ? fake.makeRedraw()
              : fake.makeUpscale();
        fake.outputs.set(`https://replicate.test/out/${id}`, bytes);
      }
      fake.onStart?.();
      if (fake.startGate) await fake.startGate;
      return { id };
    },
    get: async (id: string) => {
      fake.onRead?.();
      if (fake.readGate) await fake.readGate;
      if (fake.hasReadFailure) throw new Error('temporary provider outage');
      const plan = fake.plans.get(id) as Plan;
      return {
        id,
        status: plan.kind === 'build' ? 'processing' : plan.status,
        output: `https://replicate.test/out/${id}`,
        error: plan.status === 'failed' ? 'model error' : null,
      };
    },
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

type Rgb = [number, number, number];

// A striped rectangle on a backdrop; stripes give it edges to measure.
async function picture(size: number, box: number, colour: Rgb, backdrop: Rgb = [255, 255, 255]) {
  const data = Buffer.alloc(size * size * 3);
  const left = Math.round((size - box) / 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inside = x >= left && x < left + box && y >= left && y < left + box;
      const k = inside && Math.floor(x / 8) % 2 === 0 ? 0.6 : 1;
      const i = (y * size + x) * 3;
      for (let c = 0; c < 3; c++)
        data[i + c] = inside ? (colour[c] as number) * k : (backdrop[c] as number);
    }
  }
  return new Uint8Array(
    await sharp(data, { raw: { width: size, height: size, channels: 3 } })
      .png()
      .toBuffer(),
  );
}

const COLOUR: Rgb = [180, 90, 40];
const CELL = 682;

// A 3x3 sheet whose cells all differ (different object sizes); `grey` is a cell with a grey backdrop.
async function sheet(grey?: number) {
  const tiles = await Promise.all(
    VIEWS.map(async (_, index) => ({
      input: Buffer.from(
        await picture(
          CELL,
          300 + index * 20,
          COLOUR,
          index === grey ? [160, 160, 160] : [255, 255, 255],
        ),
      ),
      left: (index % 3) * CELL,
      top: Math.floor(index / 3) * CELL,
    })),
  );
  return new Uint8Array(
    await sharp({ create: { width: CELL * 3, height: CELL * 3, channels: 3, background: '#fff' } })
      .composite(tiles)
      .png()
      .toBuffer(),
  );
}

const run = describe.skipIf(!url);

// Real image processing and the first DB/ESM initialization exceed 5s on shared CI runners.
run('product views (real database, scripted models)', { timeout: 15_000 }, () => {
  const load = async () => ({
    views: await import('./product-views'),
    renders: await import('./renders'),
  });
  const newUser = async (credits: number) => {
    const id = `u_${Math.random().toString(36).slice(2)}`;
    await db().user.create({ data: { id, name: 'T', email: `${id}@example.com`, credits } });
    return id;
  };
  const balance = async (id: string) =>
    (await db().user.findUniqueOrThrow({ where: { id } })).credits;

  const create = async (userId: string) => {
    const { views } = await load();
    const photo = await picture(800, 400, COLOUR);
    return views.createViewSet({
      actor: { userId },
      bytes: photo,
      contentType: 'image/png',
      name: 'Armchair',
    });
  };

  // Polls like the browser does until nothing is running.
  const settle = async (id: string, userId: string) => {
    const { views } = await load();
    for (let i = 0; i < 12; i++) {
      const set = await views.getViewSet(id, { userId });
      if (set.status !== 'drafting' && set.status !== 'processing') return set;
    }
    throw new Error('still running');
  };

  beforeEach(async () => {
    fake.hasReadFailure = false;
    fake.readGate = null;
    fake.onRead = null;
    fake.hasDownloadFailure = false;
    fake.downloadGate = null;
    fake.onDownload = null;
    fake.startGate = null;
    fake.onStart = null;
    fake.files.clear();
    fake.outputs.clear();
    fake.plans.clear();
    fake.starts.length = 0;
    fake.next.sheet = [];
    fake.next.redraw = [];
    fake.next.upscale = [];
    fake.makeSheet = () => new Uint8Array();
    process.env.REPLICATE_API_TOKEN = 'test';
    const good = await sheet();
    const redraw = await picture(1024, 700, COLOUR);
    const upscaled = await picture(2046, 900, COLOUR);
    fake.makeSheet = () => good;
    fake.makeRedraw = () => redraw;
    fake.makeUpscale = () => upscaled;
  });

  afterAll(async () => {
    await db().$disconnect();
  });

  it('keeps a drafting set paid and recoverable during a temporary provider read outage', async () => {
    const { views } = await load();
    const userId = await newUser(PRODUCT_VIEWS_CREDITS);
    const set = await create(userId);
    fake.hasReadFailure = true;
    expect((await views.getViewSet(set.id, { userId })).status).toBe('drafting');
    expect(await balance(userId)).toBe(0);
    fake.hasReadFailure = false;
    expect((await settle(set.id, userId)).status).toBe('ready');
  });

  it('keeps a stale set recoverable if the refund database write fails', async () => {
    const { views } = await load();
    const userId = await newUser(2_147_483_647);
    const set = await db().viewSet.create({
      data: {
        userId,
        sourceKey: 'src',
        status: 'drafting',
        credits: PRODUCT_VIEWS_CREDITS,
        updatedAt: new Date(Date.now() - 46 * 60 * 1000),
      },
    });
    await views.advanceViewSet(set.id).catch(() => undefined);
    expect((await db().viewSet.findUniqueOrThrow({ where: { id: set.id } })).status).toBe(
      'drafting',
    );
    await db().user.update({ where: { id: userId }, data: { credits: 0 } });
    expect((await views.advanceViewSet(set.id))?.status).toBe('failed');
    expect(await balance(userId)).toBe(PRODUCT_VIEWS_CREDITS);
  });

  it('does not refund a new sheet retry when a stale poll fails after that retry starts', async () => {
    const { views } = await load();
    const userId = await newUser(PRODUCT_VIEWS_CREDITS);
    const set = await create(userId);
    await db().viewSet.update({
      where: { id: set.id },
      data: { updatedAt: new Date(Date.now() - 46 * 60 * 1000) },
    });
    let releaseRead: () => void = () => {};
    fake.readGate = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const reading = new Promise<void>((resolve) => {
      fake.onRead = resolve;
    });
    fake.hasReadFailure = true;
    const oldPoll = views.advanceViewSet(set.id);
    await reading;
    const retryId = `retry-${userId}`;
    await db().viewSet.update({
      where: { id: set.id },
      data: { sheetPredictionId: retryId, sheetAttempts: 2 },
    });
    releaseRead();
    expect(await oldPoll).toMatchObject({ status: 'drafting', sheetPredictionId: retryId });
    expect(await balance(userId)).toBe(0);
  });

  it('does not refund a newer polish stage after an expired worker returns a read error', async () => {
    const { views } = await load();
    const userId = await newUser(PRODUCT_VIEWS_CREDITS + VIEW_POLISH_CREDITS);
    const set = await create(userId);
    await settle(set.id, userId);
    const polishing = await views.polishView(set.id, 'front', { userId }, 'Keep the fabric seam');
    const view = polishing.views.find((view) => view.view === 'front');
    if (!view) throw new Error('Missing polished view');
    await db().productView.update({
      where: { id: view.id },
      data: { updatedAt: new Date(Date.now() - 11 * 60 * 1000) },
    });
    let releaseRead: () => void = () => {};
    fake.readGate = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const reading = new Promise<void>((resolve) => {
      fake.onRead = resolve;
    });
    fake.hasReadFailure = true;
    const oldPoll = views.advanceViewSet(set.id);
    await reading;
    const nextId = `upscale-${userId}`;
    await db().productView.update({
      where: { id: view.id },
      data: { status: 'upscaling', predictionId: nextId },
    });
    releaseRead();
    await oldPoll;
    expect(await db().productView.findUniqueOrThrow({ where: { id: view.id } })).toMatchObject({
      status: 'upscaling',
      predictionId: nextId,
      isPolishing: true,
    });
    expect(await balance(userId)).toBe(0);
  });

  it('does not let a downloaded old redraw overwrite or restart a newer polish revision', async () => {
    const { views } = await load();
    const userId = await newUser(PRODUCT_VIEWS_CREDITS + VIEW_POLISH_CREDITS);
    const set = await create(userId);
    await settle(set.id, userId);
    const polishing = await views.polishView(set.id, 'front', { userId }, 'Keep the fabric seam');
    const view = polishing.views.find((view) => view.view === 'front');
    if (!view) throw new Error('Missing view');
    let release: () => void = () => {};
    fake.downloadGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const downloading = new Promise<void>((resolve) => {
      fake.onDownload = resolve;
    });
    const oldPoll = views.advanceViewSet(set.id);
    await downloading;
    const newPrediction = `new-polish-${userId}`;
    await db().productView.update({
      where: { id: view.id },
      data: {
        status: 'drawing',
        predictionId: newPrediction,
        polishes: { increment: 1 },
        note: 'New request',
      },
    });
    const starts = fake.starts.length;
    release();
    await oldPoll;
    expect(await db().productView.findUniqueOrThrow({ where: { id: view.id } })).toMatchObject({
      status: 'drawing',
      predictionId: newPrediction,
      polishes: view.polishes + 1,
      note: 'New request',
    });
    expect(fake.starts).toHaveLength(starts);
  });

  it('does not revive an already settled polish when an old provider start returns late', async () => {
    const { views } = await load();
    const userId = await newUser(PRODUCT_VIEWS_CREDITS + VIEW_POLISH_CREDITS);
    const set = await create(userId);
    const done = await settle(set.id, userId);
    const view = done.views.find((view) => view.view === 'front');
    if (!view) throw new Error('Missing view');
    let release: () => void = () => {};
    fake.startGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const starting = new Promise<void>((resolve) => {
      fake.onStart = resolve;
    });
    const oldStart = views
      .polishView(set.id, 'front', { userId }, 'Keep the seam')
      .catch(() => undefined);
    await starting;
    await db().productView.update({
      where: { id: view.id },
      data: { status: 'ready', isPolishing: false, predictionId: null },
    });
    release();
    await oldStart;
    expect(await db().productView.findUniqueOrThrow({ where: { id: view.id } })).toMatchObject({
      status: 'ready',
      isPolishing: false,
      predictionId: null,
    });
  });

  it('does not mark a newly active set ready from an earlier child-read snapshot', async () => {
    const { views } = await load();
    const userId = await newUser(PRODUCT_VIEWS_CREDITS);
    const set = await create(userId);
    const done = await settle(set.id, userId);
    const view = done.views[0];
    if (!view) throw new Error('Missing view');
    await db().viewSet.update({ where: { id: set.id }, data: { status: 'processing' } });
    let oldPoll: ReturnType<typeof views.advanceViewSet> | undefined;
    await db().$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ViewSet" WHERE "id" = ${set.id} FOR UPDATE`;
      const [connection] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      if (!connection) throw new Error('Missing transaction PID');
      oldPoll = views.advanceViewSet(set.id);
      let isBlocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const waiters = await tx.$queryRaw<
          { pid: number }[]
        >`SELECT pid FROM pg_stat_activity WHERE ${connection.pid} = ANY(pg_blocking_pids(pid))`;
        if (waiters.length) {
          isBlocked = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(isBlocked).toBe(true);
      // Another worker has claimed the next paid revision after the old readiness read.
      await tx.productView.update({
        where: { id: view.id },
        data: { status: 'drawing', isPolishing: true, polishes: { increment: 1 } },
      });
      await tx.viewSet.update({
        where: { id: set.id },
        data: { status: 'processing', updatedAt: new Date(Date.now() + 1000) },
      });
    });
    await oldPoll;
    expect((await db().viewSet.findUniqueOrThrow({ where: { id: set.id } })).status).toBe(
      'processing',
    );
  });

  it('retains a paid polish prediction across temporary result download failures', async () => {
    const { views } = await load();
    const userId = await newUser(PRODUCT_VIEWS_CREDITS + VIEW_POLISH_CREDITS);
    const set = await create(userId);
    await settle(set.id, userId);
    const polishing = await views.polishView(set.id, 'front', { userId }, 'Keep the fabric seam');
    const predictionId = polishing.views.find((view) => view.view === 'front')?.predictionId;
    fake.hasDownloadFailure = true;
    const waiting = await views.getViewSet(set.id, { userId });
    expect(waiting.views.find((view) => view.view === 'front')).toMatchObject({
      status: 'drawing',
      predictionId,
      isPolishing: true,
    });
    expect(await balance(userId)).toBe(0);
    fake.hasDownloadFailure = false;
    expect((await settle(set.id, userId)).status).toBe('ready');
  });

  it('does not mark a failed polish refunded until its ledger and wallet commit', async () => {
    const { views } = await load();
    const userId = await newUser(PRODUCT_VIEWS_CREDITS + VIEW_POLISH_CREDITS);
    const set = await create(userId);
    await settle(set.id, userId);
    fake.next.redraw = ['failed', 'failed'];
    await views.polishView(set.id, 'front', { userId }, 'Keep the fabric seam');
    await db().user.update({ where: { id: userId }, data: { credits: 2_147_483_647 } });
    await views.getViewSet(set.id, { userId });
    const waiting = await views.getViewSet(set.id, { userId });
    expect(waiting.views.find((view) => view.view === 'front')).toMatchObject({
      status: 'drawing',
      isPolishing: true,
    });
    await db().user.update({ where: { id: userId }, data: { credits: 0 } });
    expect((await settle(set.id, userId)).status).toBe('ready');
    expect(await balance(userId)).toBe(VIEW_POLISH_CREDITS);
  });

  it('charges the set once, draws a 2K sheet, and delivers nine finished views', async () => {
    const userId = await newUser(PRODUCT_VIEWS_CREDITS + 10);
    const set = await create(userId);
    expect(set.status).toBe('drafting');
    expect(await balance(userId)).toBe(10);
    expect(fake.starts[0]?.path).toContain('nano-banana-2/');

    const done = await settle(set.id, userId);
    expect(done.status).toBe('ready');
    expect(done.views).toHaveLength(9);
    for (const view of done.views) {
      expect(view.status).toBe('ready');
      const meta = await sharp(fake.files.get(view.key as string)).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 2000, 2000]);
    }
    // Nothing was charged beyond the set, and every view that passed went through the upscaler.
    expect(await balance(userId)).toBe(10);
    expect(fake.starts.filter((s) => s.path === ENLARGE_MODEL.path)).toHaveLength(9);
    expect(done.costUsd).toBeGreaterThan(0);
  });

  it('draws a view that fails its check again on its own, with what was wrong', async () => {
    const userId = await newUser(PRODUCT_VIEWS_CREDITS);
    const greyed = await sheet(3);
    fake.makeSheet = () => greyed;
    const set = await create(userId);
    const done = await settle(set.id, userId);

    const redraws = fake.starts.filter((s) => s.path.includes('nano-banana-2-lite'));
    expect(redraws).toHaveLength(1);
    expect(String(redraws[0]?.body.input?.prompt)).toContain('back-right three-quarter view');
    expect(String(redraws[0]?.body.input?.prompt)).toContain('pure white');
    const view = done.views.find((item) => item.view === 'back_right');
    expect(view?.status).toBe('ready');
    expect(view?.attempts).toBe(1);
    expect(done.status).toBe('ready');
  });

  it('keeps and flags a view the model cannot fix, and never fails the set', async () => {
    const userId = await newUser(PRODUCT_VIEWS_CREDITS);
    const greyed = await sheet(3);
    fake.makeSheet = () => greyed;
    // The redraw is grey too, so the retry cannot fix it.
    const stillGrey = await picture(1024, 700, COLOUR, [160, 160, 160]);
    fake.makeRedraw = () => stillGrey;
    const { views } = await load();
    const set = await create(userId);
    const done = await settle(set.id, userId);
    expect(done.status).toBe('ready');
    const item = views.toViewSetView(done).views.find((view) => view.view === 'back_right');
    expect(item?.isFlagged).toBe(true);
    expect(item?.problems).toContain('background');
  });

  it('falls back to the drawn picture when the upscaler fails', async () => {
    const userId = await newUser(PRODUCT_VIEWS_CREDITS);
    fake.next.upscale = ['failed', 'failed', 'failed'];
    const set = await create(userId);
    const done = await settle(set.id, userId);
    expect(done.status).toBe('ready');
    expect(done.views.every((view) => view.key)).toBe(true);
  });

  it('retries a rejected sheet once, then refunds the whole set', async () => {
    const userId = await newUser(PRODUCT_VIEWS_CREDITS);
    fake.next.sheet = ['failed', 'failed'];
    const set = await create(userId);
    const failed = await settle(set.id, userId);
    expect(failed.status).toBe('failed');
    expect(fake.starts.filter((s) => s.path.includes('nano-banana-2/'))).toHaveLength(2);
    expect(await balance(userId)).toBe(PRODUCT_VIEWS_CREDITS);
  });

  it('recovers from one failed sheet with the automatic retry', async () => {
    const userId = await newUser(PRODUCT_VIEWS_CREDITS);
    fake.next.sheet = ['failed'];
    const set = await create(userId);
    expect((await settle(set.id, userId)).status).toBe('ready');
    expect(await balance(userId)).toBe(0);
  });

  it('refuses a set the buyer cannot pay for, and leaves nothing behind', async () => {
    const userId = await newUser(PRODUCT_VIEWS_CREDITS - 1);
    await expect(create(userId)).rejects.toMatchObject({ status: 402 });
    expect(await db().viewSet.count({ where: { userId } })).toBe(0);
  });

  it('polishes one view with the owner note, from the photo and the current view', async () => {
    const { views } = await load();
    const userId = await newUser(PRODUCT_VIEWS_CREDITS + VIEW_POLISH_CREDITS);
    const set = await settle((await create(userId)).id, userId);
    const before = set.views.find((view) => view.view === 'left');

    const polishing = await views.polishView(set.id, 'left', { userId }, 'make the legs thinner');
    expect(await balance(userId)).toBe(0);
    expect(polishing.status).toBe('processing');
    const request = fake.starts.at(-1);
    expect(request?.path).toContain('nano-banana-2-lite');
    expect(request?.body.input?.image_input).toHaveLength(2);
    expect(String(request?.body.input?.prompt)).toContain('make the legs thinner');

    const done = await settle(set.id, userId);
    const after = done.views.find((view) => view.view === 'left');
    expect(done.status).toBe('ready');
    expect(after?.key).not.toBe(before?.key);
    expect(after?.version).toBeGreaterThan(before?.version ?? 0);
    // The other eight views are untouched.
    for (const view of done.views.filter((item) => item.view !== 'left')) {
      expect(view.key).toBe(set.views.find((item) => item.view === view.view)?.key);
    }
  });

  it('refunds a polish that cannot be drawn and keeps the view as it was', async () => {
    const { views } = await load();
    const userId = await newUser(PRODUCT_VIEWS_CREDITS + VIEW_POLISH_CREDITS);
    const set = await settle((await create(userId)).id, userId);
    const before = set.views.find((view) => view.view === 'top');

    fake.next.redraw = ['failed', 'failed'];
    await views.polishView(set.id, 'top', { userId }, 'remove the scratch');
    const done = await settle(set.id, userId);
    expect(done.status).toBe('ready');
    expect(done.views.find((view) => view.view === 'top')?.key).toBe(before?.key);
    expect(await balance(userId)).toBe(VIEW_POLISH_CREDITS);
  });

  it('does not let a double click polish twice, and keeps other owners out', async () => {
    const { views } = await load();
    const userId = await newUser(PRODUCT_VIEWS_CREDITS + VIEW_POLISH_CREDITS * 2);
    const set = await settle((await create(userId)).id, userId);
    await Promise.allSettled([
      views.polishView(set.id, 'back', { userId }, 'fix the back'),
      views.polishView(set.id, 'back', { userId }, 'fix the back'),
    ]);
    expect(await balance(userId)).toBe(VIEW_POLISH_CREDITS);

    const stranger = await newUser(0);
    await expect(views.getViewSet(set.id, { userId: stranger })).rejects.toMatchObject({
      status: 404,
    });
    await expect(views.getViewImage(set.id, 'front', { userId: stranger })).rejects.toMatchObject({
      status: 404,
    });
  });

  it('zips every finished view', async () => {
    const { views } = await load();
    const userId = await newUser(PRODUCT_VIEWS_CREDITS);
    const set = await settle((await create(userId)).id, userId);
    const { bytes, filename } = await views.zipViewSet(set.id, { userId });
    expect(filename).toBe('armchair-views.zip');
    // The end record says how many files the archive holds.
    const end = new DataView(bytes.buffer, bytes.byteOffset + bytes.byteLength - 22, 22);
    expect(end.getUint16(10, true)).toBe(9);
  });

  it('builds 3D from the finished views for the 3D step only, without drawing the sheet again', async () => {
    const { views, renders } = await load();
    const userId = await newUser(PRODUCT_VIEWS_CREDITS + BUILD_FROM_VIEWS_CREDITS);
    // The default upscale mock repeats one picture nine times. A reusable 3D sheet must
    // retain distinct views, including after normalization, so script distinct outputs here.
    const upscaled = await Promise.all(
      VIEWS.map((_, index) =>
        picture(2046, 900, [80 + index * 20, 40 + index * 15, 20 + index * 10]),
      ),
    );
    let upscaleIndex = 0;
    fake.makeUpscale = () => upscaled[upscaleIndex++] as Uint8Array;
    const set = await settle((await create(userId)).id, userId);

    const renderId = await views.createRenderFromViews(set.id, {
      userId,
      source: 'mcp',
      apiKeyId: 'mcp-uses-api-key',
    });
    expect(await views.createRenderFromViews(set.id, { userId })).toBe(renderId);
    const render = await db().render.findUniqueOrThrow({ where: { id: renderId } });
    expect(render).toMatchObject({
      status: 'preview_ready',
      hasFinalSheet: true,
      isPublic: false,
      source: 'mcp',
    });
    expect(renders.toView(render).renderCredits).toBe(BUILD_FROM_VIEWS_CREDITS);

    const startsBefore = fake.starts.length;
    const built = await renders.startBuild(renderId, { userId });
    expect(built.status).toBe('rendering');
    expect(built.credits).toBe(BUILD_FROM_VIEWS_CREDITS);
    expect(await balance(userId)).toBe(0);
    // The only prediction started is the 3D build: no 2K sheet is drawn a second time.
    const started = fake.starts.slice(startsBefore);
    expect(started).toHaveLength(1);
    expect(started[0]?.path).toBe('/predictions');
    expect(started[0]?.body.input?.images).toHaveLength(10);
  });
});
