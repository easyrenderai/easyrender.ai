import { beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ rows: new Map<string, Record<string, unknown>>(), fail: false }));
vi.mock('@easyrender/db', () => ({
  db: () => ({
    user: { findUnique: async () => null },
    posthogDelivery: {
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        if (state.fail) throw new Error('fixture db failure');
        const id = String(create.id);
        if (!state.rows.has(id)) state.rows.set(id, { ...create });
        return state.rows.get(id);
      },
    },
  }),
}));
vi.mock('posthog-node', () => ({
  PostHog: class {
    capture() {}
    async shutdown() {}
  },
}));
vi.mock('./report', () => ({ reportError: vi.fn() }));

import { captureServer, eventUuid, setAnalyticsScheduler } from './analytics';
import { normalizeAttribution } from './attribution';

const context = {
  userId: null,
  previewId: 'fixture',
  source: 'mcp',
  attribution: normalizeAttribution(null, 'https://example.invalid'),
};
beforeEach(() => {
  state.rows.clear();
  state.fail = false;
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_fixture_not_real');
  setAnalyticsScheduler(() => undefined);
});
it('persists the event before returning even when after-response work never runs', async () => {
  await captureServer('render_ready', 'fixture', context, { duration_ms: 1 });
  expect(state.rows.get(eventUuid('render_ready:fixture'))).toMatchObject({
    event: 'render_ready',
    distinctId: 'pv_fixture',
  });
});
it('never lets an analytics persistence failure fail the successful business caller', async () => {
  state.fail = true;
  await expect(
    Promise.resolve(captureServer('render_ready', 'fixture', context, {})),
  ).resolves.toBeUndefined();
});
