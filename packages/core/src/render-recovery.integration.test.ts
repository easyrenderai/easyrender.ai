import { db } from '@easyrender/db';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Runs against a real Postgres: set TEST_DATABASE_URL (a scratch database with the schema pushed).
// Replicate, storage and error reporting are faked; the recovery pass and `advance` are real.
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

const provider = vi.hoisted(() => ({ get: vi.fn() }));
const reported = vi.hoisted(() => ({ calls: [] as { id: unknown; stage: unknown }[] }));

vi.mock('@easyrender/harness', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@easyrender/harness')>()),
  checkGlb: () => ({ ok: true, warnings: [], measures: { bytes: 50000 } }),
  download: async () => new Uint8Array(50000),
  createReplicate: () => ({ upload: vi.fn(), start: vi.fn(), get: provider.get }),
}));
vi.mock('./storage', () => ({
  getFile: async () => new Uint8Array([1]),
  putFile: async (path: string) => `fake:${path}`,
}));
vi.mock('./report', () => ({
  reportError: (_error: unknown, context: Record<string, unknown>) => {
    reported.calls.push({ id: context.renderId, stage: context.stage });
  },
}));

const run = describe.skipIf(!url);
const MINUTE = 60 * 1000;
// Other suites share this database and leave renders in flight, and the pass takes the oldest
// first. The clock runs ten days behind, so the renders below are older than all of them while
// their ages (5 to 40 minutes) stay under the 45 minute timeout.
const CLOCK_OFFSET_MS = 10 * 24 * 60 * MINUTE;

run('render recovery (real database)', () => {
  const load = () => import('./renders');
  const users: string[] = [];
  const newUser = async () => {
    const id = `u_${Math.random().toString(36).slice(2)}`;
    users.push(id);
    await db().user.create({ data: { id, name: 'T', email: `${id}@example.com`, credits: 0 } });
    return id;
  };
  const inFlight = (userId: string, tag: string, minutesAgo: number) =>
    db().render.create({
      data: {
        userId,
        sourceKey: 'fake:source.jpg',
        status: 'rendering',
        credits: 35,
        buildPredictionId: `${tag}-${minutesAgo}-${userId}`,
        updatedAt: new Date(Date.now() - minutesAgo * MINUTE),
      },
    });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.now() - CLOCK_OFFSET_MS));
    provider.get.mockReset();
    reported.calls.length = 0;
    process.env.REPLICATE_API_TOKEN = 'test';
  });

  // Remove our renders: one left running would crowd the next run's recovery pass.
  afterEach(async () => {
    vi.useRealTimers();
    await db().render.deleteMany({ where: { userId: { in: users.splice(0) } } });
  });

  afterAll(async () => {
    await db().$disconnect();
  });

  it('makes the newest render ready when older renders are still running', async () => {
    const { recoverRenders } = await load();
    const userId = await newUser();
    // Four slow jobs that are older than the render whose webhook was lost.
    const slow = await Promise.all([40, 35, 30, 25].map((age) => inFlight(userId, 'slow', age)));
    const lost = await inFlight(userId, 'lost', 5);
    provider.get.mockImplementation(async (predictionId: string) =>
      predictionId === lost.buildPredictionId
        ? { status: 'succeeded', output: 'https://provider.invalid/model.glb' }
        : { status: 'processing' },
    );

    await recoverRenders();

    expect((await db().render.findUniqueOrThrow({ where: { id: lost.id } })).status).toBe('ready');
    for (const render of slow)
      expect((await db().render.findUniqueOrThrow({ where: { id: render.id } })).status).toBe(
        'rendering',
      );
  });

  it('reports a retryable poll failure once per render and keeps its timeout deadline', async () => {
    const { advance } = await load();
    const userId = await newUser();
    const render = await inFlight(userId, 'outage', 10);
    provider.get.mockRejectedValue(new Error('temporary connection failure'));

    for (let poll = 0; poll < 3; poll++)
      expect((await advance(render.id))?.status).toBe('rendering');

    expect(reported.calls).toEqual([{ id: render.id, stage: 'render_poll_retryable' }]);
    const stored = await db().render.findUniqueOrThrow({ where: { id: render.id } });
    // The marker must not push the 45 minute deadline back.
    expect(stored.updatedAt.getTime()).toBe(render.updatedAt.getTime());
  });

  it('reports each failing render once, not once per pass', async () => {
    const { recoverRenders } = await load();
    const userId = await newUser();
    const first = await inFlight(userId, 'a', 10);
    const second = await inFlight(userId, 'b', 5);
    provider.get.mockRejectedValue(new Error('temporary connection failure'));

    await recoverRenders();
    await recoverRenders();

    const ids = reported.calls.map((call) => call.id);
    expect(ids.filter((id) => id === first.id)).toHaveLength(1);
    expect(ids.filter((id) => id === second.id)).toHaveLength(1);
  });
});
