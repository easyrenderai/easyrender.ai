import { db, type Render } from '@easyrender/db';
import { FALLBACK_SHEET_SETTINGS, ProviderRequestError, SHEET_MODEL } from '@easyrender/harness';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { advance, createDraft } from './renders';

const start = vi.fn();

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
vi.mock('./service-email', () => ({ queueRenderServiceEmail: vi.fn() }));
vi.mock('./storage', () => ({ putFile: vi.fn().mockResolvedValue('local:sources/source.png') }));
vi.mock('@easyrender/harness', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@easyrender/harness')>()),
  checkPhoto: async () => ({ ok: true, measures: {}, warnings: [] }),
  loadHarness: async () =>
    (await importOriginal<typeof import('@easyrender/harness')>()).DEFAULT_HARNESS,
  createReplicate: () => ({
    upload: async () => 'https://files.example.test/source.png',
    start: (...args: unknown[]) => start(...args),
  }),
}));

// A one-row stand-in for the render table: enough for the start path and the failure refund.
function fakeDatabase(initial?: Partial<Render>) {
  let stored = (initial ?? null) as Render | null;
  const database = {
    $transaction: async (run: (tx: unknown) => unknown) => run(database),
    $executeRaw: vi.fn(),
    user: { findUnique: vi.fn(async () => null) },
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
      updateMany: vi.fn(async ({ data }: { data: Partial<Render> }) => {
        stored = { ...stored, ...data, updatedAt: new Date() } as Render;
        return { count: 1 };
      }),
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
  vi.mocked(db).mockReset();
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
});
