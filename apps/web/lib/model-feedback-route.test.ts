import { AppError } from '@easyrender/core';
import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ save: vi.fn(), actor: vi.fn() }));
vi.mock('@easyrender/core', async (original) => ({
  ...(await original<typeof import('@easyrender/core')>()),
  saveModelFeedback: mocks.save,
}));
vi.mock('@/lib/actor', () => ({ resolveActor: mocks.actor }));

import { POST } from '@/app/api/renders/[id]/feedback/route';

function send(body: string, origin = 'https://easyrender.ai') {
  return POST(
    new Request('https://easyrender.ai/api/renders/model/feedback', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body,
    }),
    { params: Promise.resolve({ id: 'model' }) },
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.actor.mockResolvedValue({ userId: 'owner' });
  mocks.save.mockResolvedValue({ recorded: true });
});
it('returns a private receipt with no submitted comment', async () => {
  const response = await send(JSON.stringify({ rating: 2, comment: 'private text' }));
  expect(response.status).toBe(201);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toEqual({ recorded: true });
  expect(mocks.save).toHaveBeenCalledWith(
    'model',
    { userId: 'owner' },
    { rating: 2, comment: 'private text' },
  );
  expect(mocks.actor).toHaveBeenCalledWith(expect.any(Headers), 'write');
});
it.each([
  [401, 'unauthorized'],
  [404, 'not_found'],
  [409, 'feedback_exists'],
  [400, 'bad_feedback'],
])('preserves core status %i', async (status, code) => {
  mocks.save.mockRejectedValue(new AppError('Rejected', status, code));
  const response = await send('{}');
  expect(response.status).toBe(status);
  expect(await response.json()).toMatchObject({ code });
});
it('routes malformed JSON through strict core validation', async () => {
  mocks.save.mockRejectedValue(new AppError('Invalid model feedback', 400, 'bad_feedback'));
  expect((await send('{')).status).toBe(400);
  expect(mocks.save).toHaveBeenCalledWith('model', { userId: 'owner' }, null);
});
it('rejects cross-origin session writes', async () => {
  expect((await send('{}', 'https://other.invalid')).status).toBe(403);
  expect(mocks.save).not.toHaveBeenCalled();
});
