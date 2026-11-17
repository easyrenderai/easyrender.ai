import { readFileSync } from 'node:fs';
import { db, type Render } from '@easyrender/db';
import { FALLBACK_SHEET_SETTINGS, ProviderRequestError, SHEET_MODEL } from '@easyrender/harness';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { grantCreditsInTransaction } from './credits';
import { advance, createDraft, startSheet, toView } from './renders';
import { reportError } from './report';
import { putFile } from './storage';

const start = vi.fn();
const getPrediction = vi.fn();
const downloadFile = vi.fn();

vi.mock('@easyrender/db', () => ({ db: vi.fn() }));
vi.mock('./config', () => ({
  config: {
    replicateToken: () => 'test-placeholder',
    harnessToken: () => '',
    appUrl: () => 'https://example.test',
    webhookUrl: (path: string) => `https://example.test${path}`,
    sheetEnabled: () => true,
    freePreviewsPerDay: () => 2,
    paidPreviewsPerDay: () => 5,
  },
}));
vi.mock('./analytics', () => ({ captureRender: vi.fn(), deferAnalytics: vi.fn() }));
vi.mock('./report', () => ({ reportError: vi.fn() }));
vi.mock('./credits', () => ({
  spendCreditsInTransaction: vi.fn(),
  grantCreditsInTransaction: vi.fn(),
}));
vi.mock('./service-email', () => ({ queueRenderServiceEmail: vi.fn() }));
vi.mock('./storage', () => ({
  putFile: vi.fn().mockResolvedValue('local:sources/source.png'),
  getFile: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
}));
vi.mock('@easyrender/harness', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@easyrender/harness')>()),
  checkPhoto: async () => ({ ok: true, measures: {}, warnings: [] }),
  download: (...args: unknown[]) => downloadFile(...args),
  loadHarness: async () =>
    (await importOriginal<typeof import('@easyrender/harness')>()).DEFAULT_HARNESS,
  createReplicate: () => ({
    upload: async () => 'data:image/png;base64,AQID',
    start: (...args: unknown[]) => start(...args),
    get: (...args: unknown[]) => getPrediction(...args),
  }),
}));

// A one-row stand-in for the render table: enough for the start path and the failure refund.
function fakeDatabase(initial?: Partial<Render>) {
  let stored = (initial ?? null) as Render | null;
  const database = {
    $transaction: async (run: (tx: unknown) => unknown) => run(database),
    $executeRaw: vi.fn(),
    user: { findUnique: vi.fn(async () => null) },
    renderEdit: { create: vi.fn(async () => ({})) },
    viewSet: { count: vi.fn(async () => 0) },
    upscale: { count: vi.fn(async () => 0) },
    render: {
      count: vi.fn(async () => 0),
      create: vi.fn(async ({ data }: { data: Partial<Render> }) => {
        stored = {
          id: 'r1',
          credits: 0,
          userId: null,
          sheetKey: null,
          sheetRedraws: 0,
          sheetPredictionId: null,
          finalSheetPredictionId: null,
          buildPredictionId: null,
          buildClaimedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        } as Render;
        return stored;
      }),
      findUnique: vi.fn(async () => stored),
      findUniqueOrThrow: vi.fn(async () => stored as Render),
      updateMany: vi.fn(
        async ({ data, where }: { data: Partial<Render>; where?: Partial<Render> }) => {
          for (const [key, value] of Object.entries(where ?? {})) {
            if (
              value !== undefined &&
              (value === null || typeof value !== 'object') &&
              stored?.[key as keyof Render] !== value
            )
              return { count: 0 };
          }
          stored = { ...stored, ...data, updatedAt: new Date() } as Render;
          return { count: 1 };
        },
      ),
    },
  };
  vi.mocked(db).mockReturnValue(database as unknown as ReturnType<typeof db>);
  return () => stored as Render;
}

const input = {
  actor: { anonId: 'visitor', ipHash: 'ip' },
  bytes: new Uint8Array([1, 2, 3]),
  contentType: 'image/png',
};

beforeEach(() => {
  start.mockReset();
  getPrediction.mockReset();
  downloadFile.mockReset();
  vi.mocked(db).mockReset();
  vi.mocked(putFile).mockClear();
  vi.mocked(grantCreditsInTransaction).mockClear();
});

describe('starting a preview when Replicate rejects the request', () => {
  it('draws with the fallback model when Lite answers with a server error', async () => {
    const stored = fakeDatabase();
    start
      .mockRejectedValueOnce(new ProviderRequestError('Replicate POST: 500 - boom', true, 500))
      .mockResolvedValueOnce({ id: 'pred-fallback', status: 'starting' });
    await createDraft(input);
    expect(start.mock.calls.map(([path]) => path)).toEqual([
      SHEET_MODEL.path,
      FALLBACK_SHEET_SETTINGS.path,
    ]);
    expect(stored().status).toBe('drafting');
    expect(stored().sheetPredictionId).toBe('pred-fallback');
  });

  it('sends the photo inline and never stores it as a link, because Replicate rejects image URLs', async () => {
    const stored = fakeDatabase();
    start.mockResolvedValueOnce({ id: 'pred-1', status: 'starting' });
    await createDraft(input);
    const body = start.mock.calls[0]?.[1] as { input: { image_input: string[] } };
    expect(body.input.image_input).toHaveLength(1);
    expect(body.input.image_input[0]).toMatch(/^data:image\/png;base64,/);
    expect(stored().sourceUrl ?? null).toBeNull();
  });

  it('fails and tells the visitor when the fallback is rejected too', async () => {
    const stored = fakeDatabase();
    start.mockRejectedValue(new ProviderRequestError('Replicate POST: 500', true, 500));
    await expect(createDraft(input)).rejects.toMatchObject({ status: 502, code: 'upstream' });
    expect(stored().status).toBe('failed');
  });

  it('fails right away on a rejected token instead of leaving the render hanging', async () => {
    const stored = fakeDatabase();
    start.mockRejectedValue(new ProviderRequestError('Replicate POST: 402', false, 402));
    await expect(createDraft(input)).rejects.toMatchObject({ status: 502 });
    expect(start).toHaveBeenCalledTimes(1);
    expect(stored().status).toBe('failed');
  });

  it('keeps the render waiting when no answer arrived, because the job may exist', async () => {
    const stored = fakeDatabase();
    start.mockRejectedValue(new ProviderRequestError('timed out', true));
    const render = await createDraft(input);
    expect(start).toHaveBeenCalledTimes(1);
    expect(render.status).toBe('drafting');
    expect(stored().status).toBe('drafting');
  });
});

describe('a preview that never reached Replicate', () => {
  it('fails after a few minutes, not after 45', async () => {
    const stored = fakeDatabase({
      id: 'r1',
      status: 'drafting',
      sourceKey: 'local:sources/source.png',
      sheetPredictionId: null,
      sheetKey: null,
      credits: 0,
      userId: null,
      createdAt: new Date(Date.now() - 5 * 60 * 1000),
      updatedAt: new Date(Date.now() - 5 * 60 * 1000),
    });
    const result = await advance('r1');
    expect(result?.status).toBe('failed');
    expect(stored().status).toBe('failed');
  });

  it('is reported as a warning that names the lifecycle step, not as an exception', async () => {
    vi.mocked(reportError).mockClear();
    fakeDatabase({
      id: 'r1',
      status: 'drafting',
      sourceKey: 'local:sources/source.png',
      sheetPredictionId: null,
      sheetKey: null,
      credits: 0,
      userId: null,
      createdAt: new Date(Date.now() - 5 * 60 * 1000),
      updatedAt: new Date(Date.now() - 5 * 60 * 1000),
    });
    await advance('r1');
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'never started' }),
      expect.objectContaining({ renderId: 'r1', stage: 'preview_never_started' }),
      'warning',
    );
  });
});

describe('diagnostics for a rejected start', () => {
  const kindOf = async (error: ProviderRequestError) => {
    vi.mocked(reportError).mockClear();
    fakeDatabase();
    start.mockRejectedValue(error);
    await createDraft(input).catch(() => undefined);
    return vi.mocked(reportError).mock.calls.map(([, context]) => context);
  };

  it('tells an outage from a request the provider will keep rejecting', async () => {
    const outage = await kindOf(new ProviderRequestError('Replicate POST: 500', true, 500));
    expect(outage).toContainEqual(expect.objectContaining({ failureKind: 'outage' }));
    const bad = await kindOf(new ProviderRequestError('Replicate POST: 422', false, 422));
    expect(bad).toContainEqual(expect.objectContaining({ failureKind: 'input' }));
    expect(JSON.stringify(bad)).not.toContain('data:image');
  });
});

describe('starting a paid angle sheet when Replicate answers 500', () => {
  const owned = {
    id: 'r1',
    status: 'preview_ready',
    sourceKey: 'local:sources/source.png',
    sheetKey: null,
    sheetPredictionId: null,
    credits: 0,
    userId: 'u1',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Partial<Render>;
  it('retries once on the fallback model instead of failing the paid sheet', async () => {
    const stored = fakeDatabase(owned);
    start
      .mockRejectedValueOnce(new ProviderRequestError('Replicate POST: 500', true, 500))
      .mockResolvedValueOnce({ id: 'pred-fallback', status: 'starting' });
    await startSheet('r1', { userId: 'u1' });
    expect(start.mock.calls.map(([path]) => path)).toEqual([
      SHEET_MODEL.path,
      FALLBACK_SHEET_SETTINGS.path,
    ]);
    expect(stored().sheetPredictionId).toBe('pred-fallback');
  });

  it('refunds and fails when both attempts are rejected', async () => {
    const stored = fakeDatabase(owned);
    start.mockRejectedValue(new ProviderRequestError('Replicate POST: 500', true, 500));
    await expect(startSheet('r1', { userId: 'u1' })).rejects.toMatchObject({ status: 502 });
    expect(stored().status).toBe('failed');
  });

  it('never replays a start that got no answer, because the job may exist', async () => {
    fakeDatabase(owned);
    start.mockRejectedValue(new ProviderRequestError('timed out', true));
    await startSheet('r1', { userId: 'u1' });
    expect(start).toHaveBeenCalledTimes(1);
  });
});

describe('an angle sheet that repeats one view', () => {
  // The showcase vase is one view pasted into every cell: what Sentry EASYRENDERAI-D rejected.
  const repeatedSheet = new Uint8Array(
    readFileSync(new URL('../../../apps/web/public/showcase/vase-angles.jpg', import.meta.url)),
  );
  const drafting = {
    id: 'r1',
    status: 'drafting',
    sourceKey: 'local:sources/source.png',
    sheetPredictionId: 'pred-1',
    sheetKey: null,
    credits: 8,
    userId: 'u1',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Partial<Render>;

  async function advanceWithRepeatedSheet() {
    vi.mocked(reportError).mockClear();
    const stored = fakeDatabase({ ...drafting, quality: { sheetRecoveryAttempts: 1 } });
    getPrediction.mockResolvedValue({
      id: 'pred-1',
      status: 'succeeded',
      output: 'https://replicate.example/sheet.png',
    });
    downloadFile.mockResolvedValue(repeatedSheet);
    const result = await advance('r1');
    return { stored, result };
  }

  it.each(['repeated', 'inconsistent'])(
    'recovers a %s sheet once without charging again, then accepts valid views',
    async (problem) => {
      const stored = fakeDatabase({ ...drafting, quality: {}, credits: 0 });
      getPrediction.mockResolvedValue({
        status: 'succeeded',
        output: 'https://replicate.example/sheet.png',
      });
      const invalidSheet =
        problem === 'repeated'
          ? repeatedSheet
          : readFileSync(
              new URL('../../harness/src/fixtures/inconsistent-table.webp', import.meta.url),
            );
      downloadFile
        .mockResolvedValueOnce(invalidSheet)
        .mockResolvedValueOnce(
          new Uint8Array(
            readFileSync(
              new URL('../../../apps/web/public/showcase/table-angles.png', import.meta.url),
            ),
          ),
        );
      start.mockResolvedValue({ id: 'recovery-1', status: 'starting' });
      const recovering = await advance('r1');
      expect(recovering?.status).toBe('drafting');
      expect(recovering?.sheetPredictionId).toBe('recovery-1');
      expect(recovering?.quality).toMatchObject({ sheetRecoveryAttempts: 1 });
      expect(recovering?.credits).toBe(0);
      const ready = await advance('r1');
      expect(ready?.status).toBe('preview_ready');
      expect(stored().sheetKey).toBeTruthy();
      expect(start).toHaveBeenCalledTimes(1);
      expect(grantCreditsInTransaction).not.toHaveBeenCalled();
    },
  );

  it('never delivers persistent structural changes and explains the refund without leaking provider details', async () => {
    fakeDatabase({ ...drafting, quality: { sheetRecoveryAttempts: 1 } });
    getPrediction.mockResolvedValue({
      status: 'succeeded',
      output: 'https://replicate.example/sheet.png',
    });
    downloadFile.mockResolvedValue(
      readFileSync(new URL('../../harness/src/fixtures/inconsistent-table.webp', import.meta.url)),
    );
    const result = await advance('r1');
    expect(result?.status).toBe('failed');
    expect(toView(result as Render)).toMatchObject({
      failureReason: 'inconsistent_structure',
      hasSheet: false,
    });
    expect(toView(result as Render).error).toContain('refunded');
    expect(putFile).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
    expect(grantCreditsInTransaction).toHaveBeenCalledTimes(1);
  });

  it('exposes a safe actionable repeated-view failure after the retry is exhausted', async () => {
    const { result } = await advanceWithRepeatedSheet();
    expect(toView(result as Render).error).toContain('distinct angles');
    expect(toView(result as Render).error).toContain('refunded');
    expect(toView(result as Render).error).not.toContain('sheet_repeated_views');
  });

  it('concurrent polling claims only one retry and persistent repetition fails with a refund', async () => {
    fakeDatabase({ ...drafting, quality: {} });
    getPrediction.mockResolvedValue({
      status: 'succeeded',
      output: 'https://replicate.example/sheet.png',
    });
    downloadFile.mockResolvedValue(repeatedSheet);
    start.mockResolvedValue({ id: 'recovery-1', status: 'starting' });
    await Promise.all([advance('r1'), advance('r1')]);
    expect(start).toHaveBeenCalledTimes(1);
    const result = await advance('r1');
    expect(result?.status).toBe('failed');
    expect(result?.sheetKey).toBeNull();
    expect(start).toHaveBeenCalledTimes(1);
    expect(grantCreditsInTransaction).toHaveBeenCalledTimes(1);
  });

  it('does not replay or immediately refund an ambiguous recovery start', async () => {
    fakeDatabase({ ...drafting, quality: {} });
    getPrediction.mockResolvedValue({
      status: 'succeeded',
      output: 'https://replicate.example/sheet.png',
    });
    downloadFile.mockResolvedValue(repeatedSheet);
    start.mockRejectedValue(new ProviderRequestError('No response', true));
    const result = await advance('r1');
    expect(result?.status).toBe('drafting');
    expect(result?.sheetPredictionId).toBeNull();
    await advance('r1');
    expect(start).toHaveBeenCalledTimes(1);
    expect(grantCreditsInTransaction).not.toHaveBeenCalled();
  });

  it('keeps the existing approved sheet when a paid correction repeats views', async () => {
    fakeDatabase({ ...drafting, sheetKey: 'approved-sheet', sheetRedraws: 1 });
    getPrediction.mockResolvedValue({
      status: 'succeeded',
      output: 'https://replicate.example/sheet.png',
    });
    downloadFile.mockResolvedValue(repeatedSheet);
    const result = await advance('r1');
    expect(result?.status).toBe('preview_ready');
    expect(result?.sheetKey).toBe('approved-sheet');
    expect(start).not.toHaveBeenCalled();
    expect(grantCreditsInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ reason: 'sheet_redraw_failed' }),
    );
  });

  it('never keeps the sheet or starts the 3D build, and ends the render as failed', async () => {
    const { stored, result } = await advanceWithRepeatedSheet();
    expect(result?.status).toBe('failed');
    expect(stored().status).toBe('failed');
    expect(stored().error).toContain('sheet_repeated_views');
    expect(stored().sheetKey).toBeNull();
    expect(putFile).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it('refunds the credits and reports a warning, not an exception', async () => {
    await advanceWithRepeatedSheet();
    expect(grantCreditsInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 'u1', amount: 8, reason: 'render_failed' }),
    );
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('sheet_repeated_views') }),
      expect.objectContaining({ renderId: 'r1' }),
      'warning',
    );
  });
});

describe('new preview visibility', () => {
  it.each(['web', 'api', 'mcp'] as const)('defaults %s previews to private', async (source) => {
    const stored = fakeDatabase();
    start.mockResolvedValue({ id: 'pred-private', status: 'starting' });
    await createDraft({ ...input, source });
    expect(stored().isPublic).toBe(false);
  });

  it.each([false, true])('honours explicit isPublic=%s', async (isPublic) => {
    const stored = fakeDatabase();
    start.mockResolvedValue({ id: 'pred-explicit', status: 'starting' });
    await createDraft({ ...input, isPublic });
    expect(stored().isPublic).toBe(isPublic);
  });
});
