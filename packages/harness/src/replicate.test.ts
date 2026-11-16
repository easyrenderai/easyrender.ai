import { afterEach, expect, it, vi } from 'vitest';
import { createReplicate, download, ProviderRequestError } from './replicate';

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

async function startError(response: Response): Promise<ProviderRequestError> {
  const fetchImpl = (async () => response) as typeof fetch;
  const error = await createReplicate('test', fetchImpl)
    .start('/predictions', {})
    .catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(ProviderRequestError);
  return error as ProviderRequestError;
}

it('puts what Replicate said in the error, so a server error can be diagnosed', async () => {
  const error = await startError(new Response('{"detail":"model is cold"}\n', { status: 500 }));
  expect(error.message).toContain('500');
  expect(error.message).toContain('model is cold');
  expect(error.status).toBe(500);
  expect(error.isAmbiguous).toBe(true);
});

it.each([401, 402, 403])(
  'fails at once on a %i and says the token or billing was rejected',
  async (status) => {
    const error = await startError(new Response('{"detail":"no"}', { status }));
    expect(error.isAmbiguous).toBe(false);
    expect(error.status).toBe(status);
    expect(error.message).toContain('token or billing');
  },
);
