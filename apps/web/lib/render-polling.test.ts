import { afterEach, expect, it, vi } from 'vitest';
import { startRenderPolling } from './render-polling';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('recovers from a network failure and exposes the real next state', async () => {
  vi.useFakeTimers();
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(Response.json({ status: 'preview_ready', hasPreview: true }));
  vi.stubGlobal('fetch', fetcher);
  const update = vi.fn(),
    connection = vi.fn();
  const stop = startRenderPolling('example', update, connection);
  await vi.advanceTimersByTimeAsync(3000);
  expect(connection).toHaveBeenLastCalledWith(true);
  expect(update).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(3000);
  expect(update).toHaveBeenLastCalledWith({ status: 'preview_ready', hasPreview: true });
  expect(connection).toHaveBeenLastCalledWith(false);
  stop();
});
it('does not overlap a slow request or update an unmounted view', async () => {
  vi.useFakeTimers();
  let resolve: (response: Response) => void = () => {};
  const pending = new Promise<Response>((done) => {
    resolve = done;
  });
  const fetcher = vi.fn().mockReturnValue(pending);
  vi.stubGlobal('fetch', fetcher);
  const update = vi.fn(),
    connection = vi.fn();
  const stop = startRenderPolling('example', update, connection);
  await vi.advanceTimersByTimeAsync(12000);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const signal = fetcher.mock.calls[0][1].signal as AbortSignal;
  stop();
  expect(signal.aborted).toBe(true);
  resolve(Response.json({ status: 'ready' }));
  await vi.advanceTimersByTimeAsync(6000);
  expect(update).not.toHaveBeenCalled();
  expect(connection).not.toHaveBeenCalled();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('treats a non-success response as an unavailable status, not a generation failure', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
  const update = vi.fn(),
    connection = vi.fn();
  const stop = startRenderPolling('example', update, connection);
  await vi.advanceTimersByTimeAsync(3000);
  expect(connection).toHaveBeenCalledWith(true);
  expect(update).not.toHaveBeenCalled();
  stop();
});
