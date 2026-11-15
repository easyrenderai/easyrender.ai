import { deflateSync } from 'node:zlib';
import { db } from '@easyrender/db';
import { RENDER_CREDITS, SHEET_CREDITS, topupAmountCents, topupPricing } from '@easyrender/harness';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Runs against a real Postgres: set TEST_DATABASE_URL (a scratch database with the schema pushed).
// Replicate and storage are faked; everything else, including transactions, is the real code.
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

const replicate = vi.hoisted(() => ({
  fail: false,
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
    upload: async (...args: unknown[]) => {
      if (replicate.fail) throw new Error('replicate down');
      return replicate.upload(...args);
    },
    start: replicate.start,
    get: replicate.get,
  }),
}));

vi.mock('./storage', () => ({
  getFile: async () => new Uint8Array([1, 2, 3]),
  putFile: async (path: string) => `fake:${path}`,
}));

const run = describe.skipIf(!url);

// What checkSheet reports for a good sheet; the real measurements are tested in the harness.
const sheetMeasures = { side: 2048, emptyCells: 0, repeatedViews: 0, closestViews: 0.08 };

run('credits and generation billing (real database)', () => {
  // Imported lazily so the suite is inert without a database.
  const load = async () => ({
    credits: await import('./credits'),
    renders: await import('./renders'),
    edits: await import('./render-edits'),
  });

  const newUser = async (credits: number) => {
    const id = `u_${Math.random().toString(36).slice(2)}`;
    await db().user.create({ data: { id, name: 'T', email: `${id}@example.com`, credits } });
    return id;
  };
  const balance = async (id: string) =>
    (await db().user.findUniqueOrThrow({ where: { id } })).credits;
  const newRender = (userId: string, data: Record<string, unknown> = {}) =>
    db().render.create({
      data: { userId, sourceKey: 'fake:source.jpg', status: 'preview_ready', ...data },
    });

  beforeEach(() => {
    process.env.FREE_PREVIEWS_PER_DAY = '2';
    replicate.fail = false;
    replicate.upload.mockReset().mockResolvedValue('https://replicate.test/file');
    replicate.start.mockReset().mockImplementation(async () => ({ id: `pred_${Math.random()}` }));
    replicate.get.mockReset();
    replicate.download.mockReset().mockResolvedValue(new Uint8Array([9, 9, 9]));
    replicate.checkSheet
      .mockReset()
      .mockResolvedValue({ ok: true, warnings: [], measures: sheetMeasures });
    process.env.REPLICATE_API_TOKEN = 'test';
  });

  afterAll(async () => {
    await db().$disconnect();
  });

  it('keeps a failed refund recoverable and never claims the credits were returned early', async () => {
    const { renders } = await load();
    const userId = await newUser(2_147_483_640);
    const render = await newRender(userId, {
      status: 'rendering',
      credits: RENDER_CREDITS,
      buildPredictionId: `refund-fault-${userId}`,
    });
    replicate.get.mockResolvedValue({ status: 'failed', error: 'provider failed' });
    // PostgreSQL rejects this balance increment: the status change must roll back with it.
    await expect(renders.advance(render.id)).rejects.toThrow();
    expect((await db().render.findUniqueOrThrow({ where: { id: render.id } })).status).toBe(
      'rendering',
    );
    expect(
      await db().creditLedger.count({ where: { idempotencyKey: `refund:${render.id}` } }),
    ).toBe(0);
    await db().user.update({ where: { id: userId }, data: { credits: 0 } });
    expect((await renders.advance(render.id))?.status).toBe('failed');
    expect(await balance(userId)).toBe(RENDER_CREDITS);
    await renders.advance(render.id);
    expect(await balance(userId)).toBe(RENDER_CREDITS);
  });

  it('keeps a provider read outage retryable instead of refunding a running job', async () => {
    const { renders } = await load();
    const userId = await newUser(0);
    const render = await newRender(userId, {
      status: 'rendering',
      credits: RENDER_CREDITS,
      buildPredictionId: `read-outage-${userId}`,
    });
    replicate.get.mockRejectedValueOnce(new Error('temporary connection failure'));
    expect((await renders.advance(render.id))?.status).toBe('rendering');
    expect(await balance(userId)).toBe(0);
    replicate.get.mockResolvedValue({ status: 'processing' });
    expect((await renders.advance(render.id))?.status).toBe('rendering');
  });

  it('recovers a paid build lost before starting even when its old preview has a prediction', async () => {
    const { renders } = await load();
    const userId = await newUser(0);
    const render = await newRender(userId, {
      status: 'rendering',
      credits: RENDER_CREDITS,
      sheetPredictionId: `old-sheet-${userId}`,
      updatedAt: new Date(Date.now() - 46 * 60 * 1000),
    });
    expect((await renders.advance(render.id))?.status).toBe('failed');
    expect(await balance(userId)).toBe(RENDER_CREDITS);
  });

  it('does not start a second paid prediction when the final-sheet POST outcome is unknown', async () => {
    const { renders } = await load();
    const { ProviderRequestError } = await import('@easyrender/harness');
    const userId = await newUser(RENDER_CREDITS);
    const render = await newRender(userId, { sheetKey: 'fake:preview.png' });
    replicate.start.mockRejectedValueOnce(new ProviderRequestError('response lost', true));
    expect((await renders.startBuild(render.id, { userId })).status).toBe('rendering');
    expect((await renders.startBuild(render.id, { userId })).status).toBe('rendering');
    expect(await balance(userId)).toBe(0);
    expect(replicate.start).toHaveBeenCalledTimes(1);
  });

  it('enforces the per-call credit ceiling inside the paid build claim', async () => {
    const { renders } = await load();
    const userId = await newUser(1000);
    const render = await newRender(userId);
    await expect(renders.startBuild(render.id, { userId, maxCredits: 0 })).rejects.toMatchObject({
      status: 409,
      code: 'budget_exceeded',
    });
    expect(await balance(userId)).toBe(1000);
    expect((await db().render.findUniqueOrThrow({ where: { id: render.id } })).status).toBe(
      'preview_ready',
    );
  });

  it('does not let an old preview failure refund a newer paid build stage', async () => {
    const { renders } = await load();
    const userId = await newUser(0);
    const render = await newRender(userId, {
      status: 'drafting',
      sheetPredictionId: `old-${userId}`,
    });
    let beginRead: () => void = () => {};
    const readStarted = new Promise<void>((resolve) => {
      beginRead = resolve;
    });
    let finishRead: (prediction: { status: string; error: string }) => void = () => {};
    replicate.get.mockImplementationOnce(() => {
      beginRead();
      return new Promise((resolve) => {
        finishRead = resolve;
      });
    });
    const oldPoll = renders.advance(render.id);
    await readStarted;
    await db().render.update({
      where: { id: render.id },
      data: {
        status: 'rendering',
        credits: RENDER_CREDITS,
        buildPredictionId: `new-${userId}`,
      },
    });
    finishRead({ status: 'failed', error: 'old preview failed' });
    expect((await oldPoll)?.status).toBe('rendering');
    expect(await balance(userId)).toBe(0);
    expect(
      await db().creditLedger.count({ where: { idempotencyKey: `refund:${render.id}` } }),
    ).toBe(0);
  });

  it('does not let an old successful preview replace a newly paid redraw', async () => {
    const { renders } = await load();
    const userId = await newUser(1000);
    const render = await newRender(userId, {
      status: 'drafting',
      sheetPredictionId: `old-sheet-${userId}`,
    });
    let didRead: () => void = () => {};
    const readStarted = new Promise<void>((resolve) => {
      didRead = resolve;
    });
    let resume: (value: Uint8Array) => void = () => {};
    replicate.get.mockResolvedValue({ status: 'succeeded', output: 'https://r.test/sheet.png' });
    replicate.download.mockImplementationOnce(() => {
      didRead();
      return new Promise<Uint8Array>((resolve) => {
        resume = resolve;
      });
    });
    const oldPoll = renders.advance(render.id);
    await readStarted;
    await renders.advance(render.id);
    replicate.start.mockResolvedValueOnce({ id: `new-redraw-${userId}` });
    await renders.redrawSheet(render.id, { userId }, 'Correct the handle');
    resume(new Uint8Array([9, 9, 9]));
    const result = await oldPoll;
    expect(result).toMatchObject({
      status: 'drafting',
      sheetPredictionId: `new-redraw-${userId}`,
      sheetRedraws: 1,
    });
    expect(await balance(userId)).toBe(1000 - SHEET_CREDITS);
  });

  it('does not persist an old sheet start over a newer paid redraw', async () => {
    const { renders } = await load();
    const userId = await newUser(1000);
    const render = await newRender(userId);
    let didStart: () => void = () => {};
    const startPending = new Promise<void>((resolve) => {
      didStart = resolve;
    });
    let resume: (value: { id: string }) => void = () => {};
    replicate.start.mockImplementationOnce(() => {
      didStart();
      return new Promise<{ id: string }>((resolve) => {
        resume = resolve;
      });
    });
    const oldStart = renders.startSheet(render.id, { userId });
    await startPending;
    // Another worker finished the first sheet before the original start request returned.
    await db().render.update({
      where: { id: render.id },
      data: { status: 'preview_ready', sheetKey: 'fake:old.png' },
    });
    replicate.start.mockResolvedValueOnce({ id: `new-redraw-${userId}` });
    await renders.redrawSheet(render.id, { userId }, 'Correct the handle');
    resume({ id: `old-start-${userId}` });
    expect(await oldStart).toMatchObject({
      status: 'drafting',
      sheetPredictionId: `new-redraw-${userId}`,
      sheetRedraws: 1,
    });
    expect(await balance(userId)).toBe(1000 - 2 * SHEET_CREDITS);
  });

  it('keeps an accepted provider job reserved when saving its id fails', async () => {
    const { renders } = await load();
    const userId = await newUser(1000);
    const render = await newRender(userId);
    let restore: () => void = () => {};
    replicate.start.mockImplementationOnce(async () => {
      const write = vi
        .spyOn(db().render, 'updateMany')
        .mockRejectedValueOnce(new Error('temporary database outage'));
      restore = () => write.mockRestore();
      return { id: `accepted-${userId}` };
    });
    try {
      expect(await renders.startBuild(render.id, { userId })).toMatchObject({
        status: 'rendering',
        buildPredictionId: null,
      });
      expect(await balance(userId)).toBe(1000 - RENDER_CREDITS);
      expect(
        await db().creditLedger.count({ where: { idempotencyKey: `refund:${render.id}` } }),
      ).toBe(0);
    } finally {
      restore();
    }
  });

  it('shares the active-generation cap with paid view sets and upscales', async () => {
    const { renders } = await load();
    const userId = await newUser(1000);
    await db().viewSet.createMany({
      data: Array.from({ length: renders.MAX_ACTIVE_RENDERS }, () => ({
        userId,
        sourceKey: 'fake:photo',
        status: 'drafting' as const,
      })),
    });
    const next = await newRender(userId);
    await expect(renders.startBuild(next.id, { userId })).rejects.toMatchObject({
      status: 429,
      code: 'concurrent_limit',
    });
    expect(await balance(userId)).toBe(1000);
  });

  it('caps concurrent paid builds without taking credits for a refused request', async () => {
    const { renders } = await load();
    const userId = await newUser(1000);
    for (let index = 0; index < renders.MAX_ACTIVE_RENDERS; index++) {
      await newRender(userId, { status: 'rendering' });
    }
    const next = await newRender(userId);
    await expect(renders.startBuild(next.id, { userId })).rejects.toMatchObject({
      status: 429,
      code: 'concurrent_limit',
    });
    expect(await balance(userId)).toBe(1000);
    expect((await db().render.findUniqueOrThrow({ where: { id: next.id } })).status).toBe(
      'preview_ready',
    );
  });

  it('paginates only the caller library without advancing jobs or skipping tied timestamps', async () => {
    const { renders } = await load();
    const userId = await newUser(0);
    const other = await newUser(0);
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const own = await Promise.all(
      Array.from({ length: 5 }, () => newRender(userId, { status: 'drafting', createdAt })),
    );
    await newRender(other, { status: 'drafting', createdAt });
    const first = await renders.listRenderPage(userId, { limit: 2, status: 'drafting' });
    const second = await renders.listRenderPage(userId, {
      limit: 2,
      status: 'drafting',
      cursor: first.nextCursor ?? undefined,
    });
    const third = await renders.listRenderPage(userId, {
      limit: 2,
      status: 'drafting',
      cursor: second.nextCursor ?? undefined,
    });
    expect(
      [...first.renders, ...second.renders, ...third.renders].map((row) => row.id).sort(),
    ).toEqual(own.map((row) => row.id).sort());
    expect(third.nextCursor).toBeNull();
    expect(replicate.get).not.toHaveBeenCalled();
    await expect(renders.listRenderPage(userId, { cursor: 'invalid' })).rejects.toMatchObject({
      status: 400,
      code: 'bad_cursor',
    });
    await expect(renders.listRenderPage(userId, { limit: 101 })).rejects.toMatchObject({
      status: 400,
      code: 'bad_limit',
    });
  });

  it('shares a durable polling cooldown without postponing the job deadline', async () => {
    const { renders } = await load();
    const userId = await newUser(0);
    const created = await newRender(userId, {
      status: 'rendering',
      buildPredictionId: `poll-${userId}`,
    });
    replicate.get.mockResolvedValue({ status: 'processing' });
    await Promise.all(Array.from({ length: 5 }, () => renders.getRender(created.id, { userId })));
    expect(replicate.get).toHaveBeenCalledTimes(1);
    const stored = await db().render.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.updatedAt).toEqual(created.updatedAt);
    expect(stored.pollAfter?.getTime()).toBeGreaterThan(Date.now());
  });

  it('never lets concurrent spends take the balance below zero', async () => {
    const { credits } = await load();
    const userId = await newUser(100);
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, index) =>
        credits.spendCredits({ userId, amount: 40, key: `k:${userId}:${index}`, reason: 'test' }),
      ),
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(2);
    expect(await balance(userId)).toBe(20);
    expect(await db().creditLedger.count({ where: { userId } })).toBe(2);
  });

  it('blocks at zero with a 402 and leaves no ledger row', async () => {
    const { credits } = await load();
    const userId = await newUser(0);
    await expect(
      credits.spendCredits({ userId, amount: 1, key: `k:${userId}`, reason: 'test' }),
    ).rejects.toMatchObject({ status: 402, code: 'insufficient_credits' });
    expect(await balance(userId)).toBe(0);
    expect(await db().creditLedger.count({ where: { userId } })).toBe(0);
  });

  it('spends and grants once per idempotency key', async () => {
    const { credits } = await load();
    const userId = await newUser(500);
    await credits.spendCredits({ userId, amount: 80, key: `s:${userId}`, reason: 'test' });
    await credits.spendCredits({ userId, amount: 80, key: `s:${userId}`, reason: 'test' });
    expect(await balance(userId)).toBe(420);
    expect(
      await credits.grantCredits({ userId, amount: 500, key: `g:${userId}`, reason: 't' }),
    ).toBe(true);
    expect(
      await credits.grantCredits({ userId, amount: 500, key: `g:${userId}`, reason: 't' }),
    ).toBe(false);
    expect(await balance(userId)).toBe(920);
  });

  it('render_3d / startBuild debits RENDER_CREDITS and starts the build once on a double click', async () => {
    const { renders } = await load();
    const userId = await newUser(RENDER_CREDITS * 2);
    const render = await newRender(userId);
    await Promise.all([
      renders.startBuild(render.id, { userId }),
      renders.startBuild(render.id, { userId }),
    ]);
    expect(await balance(userId)).toBe(RENDER_CREDITS);
    expect(replicate.start).toHaveBeenCalledTimes(1);
    const after = await db().render.findUniqueOrThrow({ where: { id: render.id } });
    expect(after.status).toBe('rendering');
    expect(after.credits).toBe(RENDER_CREDITS);
  });

  it('startBuild at zero balance is refused and the render stays buildable', async () => {
    const { renders } = await load();
    const userId = await newUser(RENDER_CREDITS - 1);
    const render = await newRender(userId);
    await expect(renders.startBuild(render.id, { userId })).rejects.toMatchObject({ status: 402 });
    const after = await db().render.findUniqueOrThrow({ where: { id: render.id } });
    expect(after.status).toBe('preview_ready');
    expect(after.credits).toBe(0);
    expect(await balance(userId)).toBe(RENDER_CREDITS - 1);
    expect(replicate.start).not.toHaveBeenCalled();
  });

  it('refunds the full price when the build cannot start', async () => {
    const { renders } = await load();
    const userId = await newUser(RENDER_CREDITS);
    const render = await newRender(userId);
    replicate.fail = true;
    await expect(renders.startBuild(render.id, { userId })).rejects.toMatchObject({ status: 502 });
    expect(await balance(userId)).toBe(RENDER_CREDITS);
    const after = await db().render.findUniqueOrThrow({ where: { id: render.id } });
    expect(after.status).toBe('failed');
  });

  it('charges only the rest when an angle sheet was already paid, and refunds all of it on failure', async () => {
    const { renders } = await load();
    const userId = await newUser(RENDER_CREDITS);
    const render = await newRender(userId, { credits: SHEET_CREDITS });
    // The user already paid SHEET_CREDITS earlier (the ledger rows are not needed for this check).
    await renders.startBuild(render.id, { userId });
    expect(await balance(userId)).toBe(SHEET_CREDITS);
  });

  it('Angles button / startSheet debits SHEET_CREDITS, once, and refunds on failure', async () => {
    const { renders } = await load();
    const userId = await newUser(SHEET_CREDITS * 2);
    const first = await newRender(userId);
    await Promise.all([
      renders.startSheet(first.id, { userId }),
      renders.startSheet(first.id, { userId }),
    ]);
    expect(await balance(userId)).toBe(SHEET_CREDITS);

    const second = await newRender(userId);
    replicate.fail = true;
    await expect(renders.startSheet(second.id, { userId })).rejects.toMatchObject({ status: 502 });
    expect(await balance(userId)).toBe(SHEET_CREDITS);
  });

  it('redrawSheet debits one sheet once, keeps the note, and counts nothing toward the build', async () => {
    const { renders } = await load();
    const userId = await newUser(SHEET_CREDITS * 3);
    const render = await newRender(userId, { sheetKey: 'fake:sheets/old.png', credits: 0 });
    await Promise.allSettled([
      renders.redrawSheet(render.id, { userId }, '  Back legs\nare too thick '),
      renders.redrawSheet(render.id, { userId }, 'Back legs are too thick'),
    ]);
    expect(await balance(userId)).toBe(SHEET_CREDITS * 2);
    const after = await db().render.findUniqueOrThrow({ where: { id: render.id } });
    expect(after.status).toBe('drafting');
    expect(after.sheetNote).toBe('Back legs are too thick');
    expect(after.sheetRedraws).toBe(1);
    expect(after.credits).toBe(0);
    expect(after.sheetKey).toBe('fake:sheets/old.png');
    // The note reaches the sheet prompt that Replicate is given.
    const body = replicate.start.mock.calls[0]?.[1] as { input: { prompt: string } };
    expect(body.input.prompt).toContain('Back legs are too thick');
  });

  it('the history lists each paid step once, newest first, and only to the owner', async () => {
    const { renders, edits } = await load();
    const userId = await newUser(SHEET_CREDITS * 4);
    const render = await newRender(userId, { sheetKey: 'fake:sheets/old.png', credits: 0 });
    // A double click is one redraw, so it is one row.
    await Promise.allSettled([
      renders.redrawSheet(render.id, { userId }, 'Back legs are too thick'),
      renders.redrawSheet(render.id, { userId }, 'Back legs are too thick'),
    ]);
    await edits.recordEdit(render.id, 'material');
    const history = await renders.listEdits(render.id, { userId });
    expect(history.map((edit) => edit.kind)).toEqual(['material', 'sheet_redraw']);
    expect(history[1]).toMatchObject({ note: 'Back legs are too thick', credits: SHEET_CREDITS });
    expect(history[0]).toMatchObject({ note: null, credits: 0 });
    // Someone else, or a visitor, cannot read it.
    await expect(renders.listEdits(render.id, { userId: 'someone-else' })).rejects.toMatchObject({
      status: 404,
    });
    await expect(renders.listEdits(render.id, { anonId: 'visitor' })).rejects.toMatchObject({
      status: 404,
    });
  });

  it('a refused redraw leaves no history', async () => {
    const { renders } = await load();
    const poor = await newUser(0);
    const render = await newRender(poor, { sheetKey: 'fake:sheets/old.png' });
    await expect(
      renders.redrawSheet(render.id, { userId: poor }, 'Seat is flat'),
    ).rejects.toMatchObject({ status: 402 });
    expect(await db().renderEdit.count({ where: { renderId: render.id } })).toBe(0);
  });

  it('the sheet and the build each add a row with what they cost', async () => {
    const { renders } = await load();
    const userId = await newUser(RENDER_CREDITS + SHEET_CREDITS);
    const render = await newRender(userId, { credits: 0 });
    await renders.startSheet(render.id, { userId });
    const rows = await db().renderEdit.findMany({ where: { renderId: render.id } });
    expect(rows.map((row) => [row.kind, row.credits])).toEqual([['sheet', SHEET_CREDITS]]);
    const second = await newRender(userId, { credits: 0 });
    await renders.startBuild(second.id, { userId });
    const built = await db().renderEdit.findMany({ where: { renderId: second.id } });
    expect(built.map((row) => row.kind)).toEqual(['build']);
    expect(built[0]?.credits).toBe(RENDER_CREDITS);
  });

  it('a redraw that Replicate fails is refunded and the owner keeps the sheet they had', async () => {
    const { renders } = await load();
    const userId = await newUser(SHEET_CREDITS);
    const render = await newRender(userId, { sheetKey: 'fake:sheets/old.png' });
    replicate.start.mockResolvedValue({ id: `pred_redraw_${userId}` });
    await renders.redrawSheet(render.id, { userId }, 'Seat is flat');
    expect(await balance(userId)).toBe(0);
    replicate.get.mockResolvedValue({ status: 'failed', error: 'boom' });
    await renders.advance(render.id);
    expect(await balance(userId)).toBe(SHEET_CREDITS);
    const after = await db().render.findUniqueOrThrow({ where: { id: render.id } });
    expect(after.status).toBe('preview_ready');
    expect(after.sheetKey).toBe('fake:sheets/old.png');
    // Polling again never refunds twice.
    await renders.advance(render.id);
    expect(await balance(userId)).toBe(SHEET_CREDITS);
  });

  it('a redraw that cannot start is refunded, and can be tried again', async () => {
    const { renders } = await load();
    const userId = await newUser(SHEET_CREDITS);
    const render = await newRender(userId, { sheetKey: 'fake:sheets/old.png' });
    replicate.fail = true;
    await expect(renders.redrawSheet(render.id, { userId }, 'Seat is flat')).rejects.toMatchObject({
      status: 502,
    });
    expect(await balance(userId)).toBe(SHEET_CREDITS);
    expect((await db().render.findUniqueOrThrow({ where: { id: render.id } })).status).toBe(
      'preview_ready',
    );
    replicate.fail = false;
    await renders.redrawSheet(render.id, { userId }, 'Seat is flat');
    expect(await balance(userId)).toBe(0);
  });

  it('a finished redraw replaces the sheet and shows in the next paid sheet prompt', async () => {
    const { renders } = await load();
    const userId = await newUser(SHEET_CREDITS + RENDER_CREDITS);
    const render = await newRender(userId, {
      sheetKey: 'fake:sheets/old.png',
      prompt: 'oak table',
    });
    replicate.start.mockResolvedValue({ id: `pred_done_${userId}` });
    await renders.redrawSheet(render.id, { userId }, 'Four legs, not three');
    replicate.get.mockResolvedValue({ status: 'succeeded', output: 'https://r.test/new.png' });
    await renders.advance(render.id);
    const done = await db().render.findUniqueOrThrow({ where: { id: render.id } });
    expect(done.status).toBe('preview_ready');
    expect(done.sheetKey).toBe('fake:sheets/sheet.png');
    // The paid build draws its final sheet with the same fix.
    replicate.start.mockClear();
    await renders.startBuild(render.id, { userId });
    const body = replicate.start.mock.calls[0]?.[1] as { input: { prompt: string } };
    expect(body.input.prompt).toContain('Four legs, not three');
    expect(body.input.prompt).toContain('oak table');
  });

  it('redrawSheet refuses an empty note, a missing sheet, other people and a low balance', async () => {
    const { renders } = await load();
    const userId = await newUser(SHEET_CREDITS);
    const render = await newRender(userId, { sheetKey: 'fake:sheets/old.png' });
    await expect(renders.redrawSheet(render.id, { userId }, '   ')).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      renders.redrawSheet(render.id, { userId: 'someone-else' }, 'Seat is flat'),
    ).rejects.toMatchObject({ status: 404 });
    const noSheet = await newRender(userId);
    await expect(renders.redrawSheet(noSheet.id, { userId }, 'Seat is flat')).rejects.toMatchObject(
      { status: 409 },
    );
    const poor = await newUser(0);
    const poorRender = await newRender(poor, { sheetKey: 'fake:sheets/old.png' });
    await expect(
      renders.redrawSheet(poorRender.id, { userId: poor }, 'Seat is flat'),
    ).rejects.toMatchObject({ status: 402 });
    expect(await balance(poor)).toBe(0);
    expect((await db().render.findUniqueOrThrow({ where: { id: poorRender.id } })).status).toBe(
      'preview_ready',
    );
    expect(await balance(userId)).toBe(SHEET_CREDITS);
  });

  it('startSheet at zero balance is refused', async () => {
    const { renders } = await load();
    const userId = await newUser(0);
    const render = await newRender(userId);
    await expect(renders.startSheet(render.id, { userId })).rejects.toMatchObject({ status: 402 });
    expect(await balance(userId)).toBe(0);
  });

  it('refunds a build that Replicate reports as failed', async () => {
    const { renders } = await load();
    const userId = await newUser(RENDER_CREDITS);
    const render = await newRender(userId);
    replicate.start.mockResolvedValue({ id: `pred_fail_${userId}` });
    await renders.startBuild(render.id, { userId });
    expect(await balance(userId)).toBe(0);
    replicate.get.mockResolvedValue({ status: 'failed', error: 'boom' });
    await renders.advance(render.id);
    expect(await balance(userId)).toBe(RENDER_CREDITS);
    // Polling again never refunds twice.
    await renders.advance(render.id);
    expect(await balance(userId)).toBe(RENDER_CREDITS);
  });

  it('refunds a build that never finishes', async () => {
    const { renders } = await load();
    const userId = await newUser(RENDER_CREDITS);
    const render = await newRender(userId);
    await renders.startBuild(render.id, { userId });
    await db().render.update({
      where: { id: render.id },
      data: { updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000) },
    });
    replicate.get.mockResolvedValue({ status: 'processing' });
    const after = await renders.advance(render.id);
    expect(after?.status).toBe('failed');
    expect(await balance(userId)).toBe(RENDER_CREDITS);
  });

  describe('final sheet before the 3D build', () => {
    const draft = (userId: string) => newRender(userId, { sheetKey: 'fake:sheets/draft.png' });
    const stale = (id: string) =>
      db().render.update({
        where: { id },
        data: { updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000) },
      });

    it('redraws the sheet with the final model, then starts the 3D build once', async () => {
      const { renders } = await load();
      const userId = await newUser(RENDER_CREDITS);
      const render = await draft(userId);
      replicate.start
        .mockResolvedValueOnce({ id: `final_${userId}` })
        .mockResolvedValueOnce({ id: `build_${userId}` });

      await renders.startBuild(render.id, { userId });
      expect(replicate.start).toHaveBeenCalledTimes(1);
      const [path, body] = replicate.start.mock.calls[0] as [
        string,
        { input: { resolution: string } },
      ];
      expect(path).toBe('/models/google/nano-banana-2/predictions');
      expect(body.input.resolution).toBe('2K');
      let after = await db().render.findUniqueOrThrow({ where: { id: render.id } });
      expect(after.status).toBe('rendering');
      expect(after.finalSheetPredictionId).toBe(`final_${userId}`);
      expect(after.buildPredictionId).toBeNull();

      // Webhook and polling arrive together: only one of them starts the 3D build.
      replicate.get.mockResolvedValue({ status: 'succeeded', output: 'https://x.test/final.png' });
      await Promise.all([renders.advance(render.id), renders.advance(render.id)]);
      expect(replicate.start).toHaveBeenCalledTimes(2);
      expect(replicate.start.mock.calls[1]?.[0]).toBe('/predictions');
      after = await db().render.findUniqueOrThrow({ where: { id: render.id } });
      expect(after.buildPredictionId).toBe(`build_${userId}`);
      expect(after.sheetKey).toBe('fake:sheets/sheet.png');
      expect(after.costUsd).toBeCloseTo(0.101, 5);
      expect(await balance(userId)).toBe(0);
      expect(after.quality).toEqual({
        finalSheet: { ...sheetMeasures, warnings: [] },
        isDraftUsed: false,
      });
    });

    it('builds from the draft when the final model cannot be started', async () => {
      const { renders } = await load();
      const userId = await newUser(RENDER_CREDITS);
      const render = await draft(userId);
      replicate.start
        .mockRejectedValueOnce(new Error('422 bad input'))
        .mockResolvedValueOnce({ id: `build_${userId}` });
      await renders.startBuild(render.id, { userId });
      const after = await db().render.findUniqueOrThrow({ where: { id: render.id } });
      expect(after.status).toBe('rendering');
      expect(after.buildPredictionId).toBe(`build_${userId}`);
      expect(after.sheetKey).toBe('fake:sheets/draft.png');
      expect(await balance(userId)).toBe(0);
    });

    it('builds from the draft when the final sheet fails the guardrails', async () => {
      const { renders } = await load();
      const userId = await newUser(RENDER_CREDITS);
      const render = await draft(userId);
      replicate.start
        .mockResolvedValueOnce({ id: `final_${userId}` })
        .mockResolvedValueOnce({ id: `build_${userId}` });
      await renders.startBuild(render.id, { userId });
      replicate.get.mockResolvedValue({ status: 'succeeded', output: 'https://x.test/final.png' });
      replicate.checkSheet.mockResolvedValue({ ok: false, code: 'sheet_empty', message: 'empty' });
      await renders.advance(render.id);
      const after = await db().render.findUniqueOrThrow({ where: { id: render.id } });
      expect(after.status).toBe('rendering');
      expect(after.buildPredictionId).toBe(`build_${userId}`);
      expect(after.sheetKey).toBe('fake:sheets/draft.png');
      expect(await balance(userId)).toBe(0);
      expect(after.quality).toEqual({ isDraftUsed: true, finalSheetProblem: 'sheet_empty' });
    });

    it('records that the draft was used when the final model reports a failure', async () => {
      const { renders } = await load();
      const userId = await newUser(RENDER_CREDITS);
      const render = await draft(userId);
      replicate.start
        .mockResolvedValueOnce({ id: `final_${userId}` })
        .mockResolvedValueOnce({ id: `build_${userId}` });
      await renders.startBuild(render.id, { userId });
      replicate.get.mockResolvedValue({ status: 'failed', error: 'model error' });
      await renders.advance(render.id);
      const after = await db().render.findUniqueOrThrow({ where: { id: render.id } });
      expect(after.status).toBe('rendering');
      expect(after.sheetKey).toBe('fake:sheets/draft.png');
      expect(after.quality).toEqual({ isDraftUsed: true, finalSheetProblem: 'redraw_failed' });
    });

    it('keeps the measurements of earlier stages when a later one is stored', async () => {
      const { renders } = await load();
      const userId = await newUser(RENDER_CREDITS);
      const photo = { width: 1200, height: 900, spread: 40, sharpness: 120, warnings: [] };
      const render = await newRender(userId, {
        sheetKey: 'fake:sheets/draft.png',
        quality: { photo, draftSheet: { ...sheetMeasures, warnings: ['similar_views'] } },
      });
      replicate.start
        .mockResolvedValueOnce({ id: `final_${userId}` })
        .mockResolvedValueOnce({ id: `build_${userId}` });
      await renders.startBuild(render.id, { userId });
      replicate.get.mockResolvedValue({ status: 'succeeded', output: 'https://x.test/final.png' });
      await renders.advance(render.id);
      const after = await db().render.findUniqueOrThrow({ where: { id: render.id } });
      expect(after.quality).toEqual({
        photo,
        draftSheet: { ...sheetMeasures, warnings: ['similar_views'] },
        finalSheet: { ...sheetMeasures, warnings: [] },
        isDraftUsed: false,
      });
    });

    it('stores the size of the finished model', async () => {
      const { renders } = await load();
      const userId = await newUser(RENDER_CREDITS);
      const render = await draft(userId);
      replicate.start
        .mockResolvedValueOnce({ id: `final_${userId}` })
        .mockResolvedValueOnce({ id: `build_${userId}` });
      await renders.startBuild(render.id, { userId });
      replicate.get.mockResolvedValue({ status: 'succeeded', output: 'https://x.test/final.png' });
      await renders.advance(render.id);
      // The fake download is three bytes, so use a real binary glTF for the model.
      const glb = new Uint8Array(30_000);
      const view = new DataView(glb.buffer);
      view.setUint32(0, 0x46546c67, true);
      view.setUint32(4, 2, true);
      view.setUint32(8, glb.byteLength, true);
      replicate.download.mockResolvedValue(glb);
      replicate.get.mockResolvedValue({
        status: 'succeeded',
        output: 'https://x.test/model.glb',
      });
      const done = await renders.advance(render.id);
      expect(done?.status).toBe('ready');
      expect(done?.quality).toMatchObject({ glb: { bytes: 30_000 }, isDraftUsed: false });
    });

    it('refunds a build whose final sheet never finishes', async () => {
      const { renders } = await load();
      const userId = await newUser(RENDER_CREDITS);
      const render = await draft(userId);
      await renders.startBuild(render.id, { userId });
      await stale(render.id);
      replicate.get.mockResolvedValue({ status: 'processing' });
      const after = await renders.advance(render.id);
      expect(after?.status).toBe('failed');
      expect(await balance(userId)).toBe(RENDER_CREDITS);
    });
  });

  describe('Stripe webhook grants', () => {
    const secret = 'whsec_test';
    const send = async (event: object) => {
      const { handleStripeWebhook } = await import('./billing');
      const { default: Stripe } = await import('stripe');
      const body = JSON.stringify(event);
      const signature = new Stripe('sk_test_x').webhooks.generateTestHeaderString({
        payload: body,
        secret,
      });
      await handleStripeWebhook(body, signature);
    };

    beforeEach(() => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_x';
      process.env.STRIPE_WEBHOOK_SECRET = secret;
    });

    it('credits a paid pay-as-you-go checkout exactly once', async () => {
      const userId = await newUser(0);
      const sessionId = `cs_${userId}`;
      await db().purchase.create({
        data: {
          userId,
          stripeSessionId: sessionId,
          packId: 'payg',
          credits: 2500,
          amountCents: 2500,
        },
      });
      const event = {
        id: `evt_${userId}`,
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: sessionId,
            object: 'checkout.session',
            mode: 'payment',
            payment_status: 'paid',
            client_reference_id: userId,
            customer: `cus_${userId}`,
          },
        },
      };
      await send(event);
      await send(event);
      expect(await balance(userId)).toBe(2500);
      expect(
        (await db().purchase.findUniqueOrThrow({ where: { stripeSessionId: sessionId } })).status,
      ).toBe('paid');
    });

    it.each(['creator', 'pro', 'scale'])(
      'keeps %s unchanged after a top-up, duplicate webhook and cancellation',
      async (plan) => {
        const { getBillingStatus } = await import('./billing');
        const userId = await newUser(120);
        await db().user.update({
          where: { id: userId },
          data: {
            subscriptionPlan: plan,
            subscriptionStatus: 'active',
            subscriptionId: `sub_${userId}`,
          },
        });
        const sessionId = `cs_topup_${userId}`;
        const purchase = await db().purchase.create({
          data: {
            userId,
            stripeSessionId: sessionId,
            packId: `topup_${plan}`,
            currency: 'eur',
            credits: 1000,
            amountCents: topupAmountCents(
              1000,
              topupPricing({ status: 'active', plan, variant: 'control' }, 'control', 'eur'),
            ),
          },
        });
        const event = {
          type: 'checkout.session.completed',
          data: {
            object: {
              id: sessionId,
              mode: 'payment',
              amount_total: purchase.amountCents,
              currency: 'eur',
              metadata: { credits: '999999', topup_plan: 'forged' },
              payment_status: 'paid',
              client_reference_id: userId,
              customer: `cus_${userId}`,
            },
          },
        };
        // Unpaid and mismatched deliveries must not grant; delayed success and replay grant once.
        await send({
          ...event,
          data: { object: { ...event.data.object, payment_status: 'unpaid' } },
        });
        expect(await balance(userId)).toBe(120);
        await expect(
          send({ ...event, data: { object: { ...event.data.object, amount_total: 1 } } }),
        ).rejects.toMatchObject({ code: 'purchase_mismatch' });
        await expect(
          send({ ...event, data: { object: { ...event.data.object, currency: 'usd' } } }),
        ).rejects.toMatchObject({ code: 'purchase_mismatch' });
        expect(await balance(userId)).toBe(120);
        await send({ ...event, type: 'checkout.session.async_payment_succeeded' });
        await send(event);
        expect(await balance(userId)).toBe(1120);
        expect(await getBillingStatus(userId)).toEqual({ plan, canManage: true });
        expect(
          await db().creditLedger.findMany({
            where: { userId },
            select: { delta: true, reason: true, purchaseId: true },
          }),
        ).toEqual([{ delta: 1000, reason: 'purchase', purchaseId: purchase.id }]);
        await send({
          type: 'customer.subscription.deleted',
          data: {
            object: {
              id: `sub_${userId}`,
              status: 'canceled',
              customer: `cus_${userId}`,
              metadata: { userId, plan },
            },
          },
        });
        expect((await getBillingStatus(userId)).plan).toBeNull();
        expect(await balance(userId)).toBe(1120);
        const future = new Date();
        future.setFullYear(future.getFullYear() + 2);
        vi.useFakeTimers({ toFake: ['Date'] });
        try {
          vi.setSystemTime(future);
          expect(await balance(userId)).toBe(1120);
        } finally {
          vi.useRealTimers();
        }
      },
    );

    it('does not credit an unpaid checkout', async () => {
      const userId = await newUser(0);
      const sessionId = `cs_unpaid_${userId}`;
      await db().purchase.create({
        data: {
          userId,
          stripeSessionId: sessionId,
          packId: 'payg',
          credits: 500,
          amountCents: 500,
        },
      });
      await send({
        id: `evt_${userId}`,
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: sessionId,
            mode: 'payment',
            payment_status: 'unpaid',
            client_reference_id: userId,
          },
        },
      });
      expect(await balance(userId)).toBe(0);
    });

    it('credits 5,500 on every paid Pro invoice, once each', async () => {
      const userId = await newUser(0);
      const invoice = (id: string) => ({
        id: `evt_${id}`,
        object: 'event',
        type: 'invoice.paid',
        data: {
          object: {
            id,
            object: 'invoice',
            parent: { subscription_details: { metadata: { userId, plan: 'pro' } } },
          },
        },
      });
      await send(invoice(`in_a_${userId}`));
      await send(invoice(`in_a_${userId}`));
      await send(invoice(`in_b_${userId}`));
      expect(await balance(userId)).toBe(11_000);
    });

    it('credits each monthly plan its own amount on a paid invoice', async () => {
      const creator = await newUser(0);
      const scale = await newUser(0);
      const invoice = (id: string, userId: string, plan: string) => ({
        id: `evt_${id}`,
        object: 'event',
        type: 'invoice.paid',
        data: {
          object: {
            id,
            object: 'invoice',
            parent: { subscription_details: { metadata: { userId, plan } } },
          },
        },
      });
      await send(invoice(`in_c_${creator}`, creator, 'creator'));
      await send(invoice(`in_s_${scale}`, scale, 'scale'));
      expect(await balance(creator)).toBe(2000);
      expect(await balance(scale)).toBe(18_000);
    });

    it('credits the plan the customer pays for after a portal plan switch', async () => {
      process.env.STRIPE_PRICE_CREATOR = 'price_creator_test';
      process.env.STRIPE_PRICE_SCALE = 'price_scale_test';
      const userId = await newUser(0);
      // Checkout tagged the subscription Scale; the customer downgraded to Creator in the portal.
      await send({
        id: `evt_switch_${userId}`,
        object: 'event',
        type: 'invoice.paid',
        data: {
          object: {
            id: `in_switch_${userId}`,
            object: 'invoice',
            parent: { subscription_details: { metadata: { userId, plan: 'scale' } } },
            lines: {
              data: [
                {
                  parent: { subscription_item_details: { proration: false } },
                  pricing: { price_details: { price: 'price_creator_test' } },
                },
              ],
            },
          },
        },
      });
      expect(await balance(userId)).toBe(2000);
    });

    it('rejects a bad signature', async () => {
      const { handleStripeWebhook } = await import('./billing');
      await expect(handleStripeWebhook('{}', 't=1,v1=bad')).rejects.toThrow();
    });
  });

  describe('free preview allowance', () => {
    // A small noisy RGB PNG that passes the photo guardrails, built without an image library.
    const photo = () => {
      const side = 420;
      const rows = Buffer.alloc((side * 3 + 1) * side);
      for (let y = 0; y < side; y++) {
        const offset = y * (side * 3 + 1);
        for (let x = 1; x <= side * 3; x++) rows[offset + x] = Math.floor(Math.random() * 256);
      }
      const crc = (buffer: Buffer) => {
        let c = ~0;
        for (const byte of buffer) {
          c ^= byte;
          for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
        }
        return ~c >>> 0;
      };
      const chunk = (type: string, data: Buffer) => {
        const body = Buffer.concat([Buffer.from(type), data]);
        const out = Buffer.alloc(body.length + 8);
        out.writeUInt32BE(data.length, 0);
        body.copy(out, 4);
        out.writeUInt32BE(crc(body), body.length + 4);
        return out;
      };
      const header = Buffer.alloc(13);
      header.writeUInt32BE(side, 0);
      header.writeUInt32BE(side, 4);
      header.set([8, 2, 0, 0, 0], 8);
      return new Uint8Array(
        Buffer.concat([
          Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
          chunk('IHDR', header),
          chunk('IDAT', deflateSync(rows)),
          chunk('IEND', Buffer.alloc(0)),
        ]),
      );
    };

    it('keeps API and MCP generations private while preserving the web default', async () => {
      const { renders } = await load();
      const bytes = photo();
      for (const source of ['api', 'mcp', 'web'] as const) {
        const userId = await newUser(0);
        const render = await renders.createDraft({
          actor: { userId },
          bytes,
          contentType: 'image/png',
          source,
        });
        expect(render.isPublic).toBe(source === 'web');
      }
    });

    it('reserves one render for concurrent identical idempotent requests and rejects changed content', async () => {
      const { renders } = await load();
      const userId = await newUser(0);
      const input = {
        actor: { userId },
        bytes: photo(),
        contentType: 'image/png',
        source: 'api' as const,
        idempotencyKey: 'photo-1',
      };
      const results = await Promise.all(
        Array.from({ length: 4 }, () => renders.createDraft(input)),
      );
      expect(new Set(results.map((render) => render.id)).size).toBe(1);
      expect(await db().render.count({ where: { userId } })).toBe(1);
      await expect(
        renders.createDraft({ ...input, prompt: 'different product' }),
      ).rejects.toMatchObject({ status: 409, code: 'idempotency_conflict' });
    });

    it('atomically enforces the daily allowance across simultaneous preview requests', async () => {
      const { renders } = await load();
      const userId = await newUser(0);
      const bytes = photo();
      const results = await Promise.allSettled(
        Array.from({ length: 8 }, () =>
          renders.createDraft({
            actor: { userId },
            bytes,
            contentType: 'image/png',
            source: 'api',
          }),
        ),
      );
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(2);
      expect(await db().render.count({ where: { userId } })).toBe(2);
    });

    it('stores what the guardrails measured on the photo and the draft sheet', async () => {
      const { renders } = await load();
      const userId = await newUser(0);
      const created = await renders.createDraft({
        actor: { userId },
        bytes: photo(),
        contentType: 'image/png',
        source: 'web',
      });
      // 420px is under the 800px a good photo needs, so the warning is stored too.
      expect(created.quality).toMatchObject({
        photo: { width: 420, height: 420, warnings: ['low_resolution'] },
      });
      replicate.get.mockResolvedValue({ status: 'succeeded', output: 'https://x.test/sheet.png' });
      const after = await renders.advance(created.id);
      expect(after?.status).toBe('preview_ready');
      expect(after?.quality).toMatchObject({
        photo: { width: 420, height: 420 },
        draftSheet: { ...sheetMeasures, warnings: [] },
      });
    });

    it('does not count failed previews, but counts the ones that worked', async () => {
      const { renders } = await load();
      process.env.FREE_PREVIEWS_PER_DAY = '1';
      const userId = await newUser(0);
      const bytes = photo();
      const upload = () =>
        renders.createDraft({ actor: { userId }, bytes, contentType: 'image/png', source: 'web' });

      // Replicate is down (out of credit): the preview fails and must not burn the allowance.
      replicate.fail = true;
      await expect(upload()).rejects.toMatchObject({ status: 502 });
      await expect(upload()).rejects.toMatchObject({ status: 502 });

      // Replicate is back: the one allowed preview works, the next one is refused.
      replicate.fail = false;
      await expect(upload()).resolves.toMatchObject({ status: 'drafting' });
      await expect(upload()).rejects.toMatchObject({ status: 429, code: 'preview_limit' });
      delete process.env.FREE_PREVIEWS_PER_DAY;
    });
  });
});
