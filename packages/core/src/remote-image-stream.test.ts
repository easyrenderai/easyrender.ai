import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
  targets: [] as Array<Record<string, unknown>>,
  replies: [] as Array<{ status: number; headers: Record<string, string>; chunks?: Uint8Array[] }>,
}));
vi.mock('node:dns/promises', () => ({ lookup: state.lookup }));
vi.mock('node:https', () => ({
  request: (options: Record<string, unknown>, callback: (response: PassThrough) => void) => {
    state.targets.push(options);
    const request = new EventEmitter();
    Object.assign(request, {
      end: () =>
        queueMicrotask(() => {
          const next = state.replies.shift() ?? {
            status: 200,
            headers: { 'content-type': 'image/jpeg' },
            chunks: [new Uint8Array([1, 2, 3])],
          };
          const response = Object.assign(new PassThrough(), {
            statusCode: next.status,
            headers: next.headers,
          });
          callback(response);
          for (const chunk of next.chunks ?? []) {
            if (!response.destroyed) response.write(chunk);
          }
          if (!response.destroyed) response.end();
        }),
    });
    return request;
  },
}));
const { fetchRemoteImage } = await import('./remote-image');
afterEach(() => {
  state.targets.length = 0;
  state.replies.length = 0;
  state.lookup.mockClear();
});

describe('remote image transport', () => {
  it('pins the connection to the vetted IP while retaining TLS and Host identity', async () => {
    const image = await fetchRemoteImage('https://cdn.example.com/photo.jpg');
    expect([...image.bytes]).toEqual([1, 2, 3]);
    expect(state.targets[0]).toMatchObject({
      hostname: '93.184.216.34',
      servername: 'cdn.example.com',
      headers: { host: 'cdn.example.com' },
    });
    expect(state.lookup).toHaveBeenCalledTimes(1);
  });
  it('rejects a redirect into private addresses before connecting there', async () => {
    state.replies.push({ status: 302, headers: { location: 'https://127.0.0.1/private' } });
    await expect(fetchRemoteImage('https://cdn.example.com/photo.jpg')).rejects.toMatchObject({
      code: 'bad_url',
    });
    expect(state.targets).toHaveLength(1);
  });
  it('rejects oversized chunked bodies without relying on content-length', async () => {
    state.replies.push({
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
      chunks: [new Uint8Array(4 * 1024 * 1024), new Uint8Array(1)],
    });
    await expect(fetchRemoteImage('https://cdn.example.com/photo.jpg')).rejects.toMatchObject({
      status: 413,
      code: 'too_large',
    });
  });
  it('rejects embedded credentials and non-image responses', async () => {
    await expect(
      fetchRemoteImage('https://u:pass@cdn.example.com/photo.jpg'),
    ).rejects.toMatchObject({ code: 'bad_url' });
    expect(state.targets).toHaveLength(0);
    state.replies.push({ status: 200, headers: { 'content-type': 'text/html' } });
    await expect(fetchRemoteImage('https://cdn.example.com/photo.jpg')).rejects.toMatchObject({
      status: 415,
      code: 'bad_type',
    });
  });
});
