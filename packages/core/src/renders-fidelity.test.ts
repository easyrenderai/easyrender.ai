import { db, type Render } from '@easyrender/db';
import { describe, expect, it, vi } from 'vitest';
import { advance } from './renders';
import { putFile } from './storage';

vi.mock('@easyrender/db', () => ({ db: vi.fn() }));
vi.mock('./config', () => ({ config: { replicateToken: () => 'test-placeholder' } }));
vi.mock('./analytics', () => ({ captureRender: vi.fn(), deferAnalytics: vi.fn() }));
vi.mock('./report', () => ({ reportError: vi.fn() }));
vi.mock('./service-email', () => ({ queueRenderServiceEmail: vi.fn() }));
vi.mock('./storage', () => ({
  getFile: vi.fn().mockRejectedValue(new Error('source unavailable')),
  putFile: vi.fn().mockResolvedValue('local:models/model.glb'),
}));
vi.mock('@easyrender/harness', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@easyrender/harness')>()),
  createReplicate: () => ({
    get: async () => ({
      status: 'succeeded',
      output: { model_file: 'https://example.com/model.glb' },
    }),
  }),
  findGlbUrl: () => 'https://example.com/model.glb',
  download: async () => new Uint8Array([1, 2, 3]),
  checkGlb: () => ({ ok: true, measures: { bytes: 3 } }),
}));

describe('render completion with failed fidelity QA', () => {
  it('stores the original model, reaches ready, and retains publication with a review flag', async () => {
    let stored = {
      id: 'r1',
      status: 'rendering',
      sourceKey: 'source',
      buildPredictionId: 'prediction',
      updatedAt: new Date(),
      isPublic: true,
      quality: {},
      name: null,
      prompt: null,
    } as unknown as Render;
    const database = {
      $transaction: async (run: (tx: unknown) => unknown) => run(database),
      render: {
        findUnique: vi.fn(async () => stored),
        updateMany: vi.fn(async ({ data }: { data: Partial<Render> }) => {
          stored = { ...stored, ...data };
          return { count: 1 };
        }),
      },
    };
    vi.mocked(db).mockReturnValue(database as unknown as ReturnType<typeof db>);
    const result = await advance('r1');
    expect(result?.status).toBe('ready');
    expect(result?.isPublic).toBe(true);
    expect(result?.glbKey).toBe('local:models/model.glb');
    expect(result?.quality).toMatchObject({
      fidelity: { report: { isFlagged: true, status: 'unavailable' } },
    });
    expect(
      vi.mocked(putFile).mock.calls.find(([path]) => path === 'models/model.glb')?.[1],
    ).toEqual(new Uint8Array([1, 2, 3]));
  });
});
