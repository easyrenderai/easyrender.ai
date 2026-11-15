import { expect, it, vi } from 'vitest';

vi.mock('@easyrender/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@easyrender/core')>()),
  config: { appUrl: () => 'https://easyrender.ai' },
  reportError: vi.fn(),
  resourceMetadataUrl: () => 'https://easyrender.ai/.well-known/oauth-protected-resource/api/mcp',
}));
const { serveMcpRequest } = await import('./http');
const actor = async () => ({ userId: 'u1' });
it('allows bearer-only browser preflights and exposes OAuth challenges', async () => {
  const preflight = await serveMcpRequest(
    new Request('https://easyrender.ai/api/mcp', {
      method: 'OPTIONS',
      headers: { origin: 'https://client.example' },
    }),
    actor,
  );
  expect(preflight.status).toBe(204);
  expect(preflight.headers.get('access-control-allow-headers')).toContain('authorization');
  expect(preflight.headers.get('access-control-allow-credentials')).toBeNull();
  const unauthorized = await serveMcpRequest(
    new Request('https://easyrender.ai/api/mcp'),
    async () => null,
  );
  expect(unauthorized.status).toBe(401);
  expect(unauthorized.headers.get('www-authenticate')).toContain('resource_metadata');
  expect(unauthorized.headers.get('access-control-expose-headers')).toContain('www-authenticate');
});
it.each(['null', 'http://untrusted.example', 'https://client.example/path'])(
  'rejects invalid origin %s',
  async (origin) => {
    const resolve = vi.fn(actor);
    const response = await serveMcpRequest(
      new Request('https://easyrender.ai/api/mcp', { method: 'OPTIONS', headers: { origin } }),
      resolve,
    );
    expect(response.status).toBe(403);
    expect(resolve).not.toHaveBeenCalled();
  },
);
it('serves a complete JSON-RPC initialize response before cleanup', async () => {
  const response = await serveMcpRequest(
    new Request('https://easyrender.ai/api/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'test', version: '1' },
        },
      }),
    }),
    actor,
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    id: 1,
    result: { serverInfo: { name: 'easyrender' } },
  });
});
it('declines standalone SSE connections for a stateless JSON server', async () => {
  const response = await serveMcpRequest(new Request('https://easyrender.ai/api/mcp'), actor);
  expect(response.status).toBe(405);
});
it('catches authentication infrastructure failures without leaking details', async () => {
  const response = await serveMcpRequest(new Request('https://easyrender.ai/api/mcp'), async () => {
    throw Error('sensitive db info');
  });
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain('sensitive');
});
