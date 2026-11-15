import { afterEach, expect, it, vi } from 'vitest';
import { createReplicate, download } from './replicate';

afterEach(() => vi.useRealTimers());

it('does not create a second prediction after an ambiguous server error', async () => {
  let created = 0;
  const fetchImpl = (async () => {
    created++;
    return created === 1
      ? new Response('unknown outcome', { status: 503 })
      : Response.json({ id: 'duplicate', status: 'starting' });
  }) as typeof fetch;
  const request = createReplicate('test', fetchImpl).start('/predictions', {});
  await expect(request).rejects.toThrow();
  expect(created).toBe(1);
});

it('bounds provider requests with an abort signal', async () => {
  const fetchImpl = (async (_url: unknown, init: RequestInit) => {
    expect(init.signal).toBeInstanceOf(AbortSignal);
    return Response.json({ id: 'p1', status: 'processing' });
  }) as typeof fetch;
  expect((await createReplicate('test', fetchImpl).get('p1')).status).toBe('processing');
});

it('keeps safe polling retries bounded and returns the eventual status', async () => {
  vi.useFakeTimers();
  let requests = 0;
  const fetchImpl = (async () => {
    requests++;
    return requests === 1
      ? new Response('', { status: 503 })
      : Response.json({ id: 'p1', status: 'processing' });
  }) as typeof fetch;
  const pending = createReplicate('test', fetchImpl).get('p1');
  await vi.runAllTimersAsync();
  expect((await pending).status).toBe('processing');
});

it('also bounds result downloads', async () => {
  const fetchImpl = (async (_url: unknown, init: RequestInit) => {
    expect(init.signal).toBeInstanceOf(AbortSignal);
    return new Response(new Uint8Array([1, 2, 3]));
  }) as typeof fetch;
  expect(await download('https://provider.test/result.glb', fetchImpl)).toEqual(
    new Uint8Array([1, 2, 3]),
  );
});
