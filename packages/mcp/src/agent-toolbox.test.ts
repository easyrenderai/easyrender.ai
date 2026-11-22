import { describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => ({ getRender: vi.fn() }));
vi.mock('@easyrender/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@easyrender/core')>();
  return { ...actual, ...core, reportError: vi.fn() };
});
const { openToolbox } = await import('./agent');
const { AppError } = await import('@easyrender/core');

describe('the agent toolbox', () => {
  it('hands the model the reason a tool failed, not a schema error', async () => {
    core.getRender.mockRejectedValue(new AppError('Render not found', 404, 'not_found'));
    const toolbox = await openToolbox({ userId: 'u1' });
    try {
      const outcome = await toolbox.call('get_render', { id: 'r1' });
      expect(outcome.isError).toBe(true);
      expect(outcome.text).toContain('not_found');
      expect(outcome.text).toContain('Render not found');
    } finally {
      await toolbox.close();
    }
  });
});
