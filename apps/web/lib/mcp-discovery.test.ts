import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  principal: vi.fn(),
  limit: vi.fn(),
  renders: vi.fn(),
}));
vi.mock('@easyrender/core', async (original) => ({
  ...(await original<typeof import('@easyrender/core')>()),
  verifyApiKeyPrincipal: mocks.principal,
  consumeApiRateLimit: mocks.limit,
  listRenderPage: mocks.renders,
  resourceMetadataUrl: () => 'https://easyrender.ai/.well-known/oauth-protected-resource/api/mcp',
}));

import { POST } from '@/app/api/mcp/route';
import { config } from '@/proxy';

function request(body: unknown, authorization?: string) {
  return new Request('https://easyrender.ai/api/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2025-11-25',
      'x-forwarded-for': '192.0.2.1',
      cookie: 'better-auth.session_token=not-an-api-key',
      ...(authorization ? { authorization } : {}),
    },
    body: JSON.stringify(body),
  });
}
const rpc = (method: string, params = {}, id: number | string = 1) => ({
  jsonrpc: '2.0',
  id,
  method,
  params,
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.principal.mockImplementation(async (token) =>
    token === 'er_test_key'
      ? {
          id: 'key1',
          userId: 'owner',
          scopes: ['read'],
        }
      : null,
  );
  mocks.renders.mockResolvedValue({ renders: [], nextCursor: null });
});

it('allows an anonymous discovery handshake and lists the real tool schemas', async () => {
  const initialize = await POST(
    request(
      rpc('initialize', {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'directory', version: '1' },
      }),
    ),
  );
  expect(initialize.status).toBe(200);
  expect(await initialize.json()).toMatchObject({ result: { serverInfo: { name: 'easyrender' } } });
  const initialized = await POST(request({ jsonrpc: '2.0', method: 'notifications/initialized' }));
  expect(initialized.status).toBe(202);
  const ping = await POST(request(rpc('ping')));
  expect(await ping.json()).toMatchObject({ id: 1, result: {} });
  const list = await POST(request(rpc('tools/list')));
  expect(list.status).toBe(200);
  const body = await list.json();
  expect(body.result.tools).toHaveLength(16);
  expect(body.result.tools).toContainEqual(
    expect.objectContaining({ name: 'render_3d', inputSchema: expect.any(Object) }),
  );
  expect(mocks.renders).not.toHaveBeenCalled();
  expect(mocks.limit).toHaveBeenCalledWith(expect.stringMatching(/^mcp:anonymous:/), 120);
});

it.each([undefined, 'Bearer er_invalid', 'Basic ignored'])(
  'rejects tool execution with missing or invalid credentials: %s',
  async (authorization) => {
    const response = await POST(
      request(rpc('tools/call', { name: 'list_renders', arguments: {} }, 'call-1'), authorization),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata');
    expect(await response.json()).toMatchObject({
      jsonrpc: '2.0',
      id: 'call-1',
      error: {
        message: 'Pass an easyrender API key as Authorization: Bearer er_...',
        data: { code: 'unauthorized', status: 401 },
      },
    });
    expect(mocks.renders).not.toHaveBeenCalled();
  },
);

it('rejects every advertised tool anonymously, including credit-spending tools', async () => {
  const list = await POST(request(rpc('tools/list')));
  const { result } = await list.json();
  for (const tool of result.tools) {
    const response = await POST(request(rpc('tools/call', { name: tool.name, arguments: {} })));
    expect(await response.json()).toMatchObject({
      id: 1,
      error: { data: { code: 'unauthorized' } },
    });
  }
});

it('executes an authenticated tool with the verified owner and keeps the key rate limit', async () => {
  const response = await POST(
    request(rpc('tools/call', { name: 'list_renders', arguments: {} }), 'Bearer er_test_key'),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    result: { structuredContent: { renders: [], next_cursor: null } },
  });
  expect(mocks.renders).toHaveBeenCalledWith('owner', {});
  expect(mocks.limit).toHaveBeenCalledWith('api:key1', 120);
});

it('does not let discovery in a batch authorize a tool call', async () => {
  const response = await POST(
    request([
      rpc('tools/list', {}, 1),
      rpc('tools/call', { name: 'list_renders', arguments: {} }, 2),
    ]),
  );
  expect(await response.json()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: 1,
        result: expect.objectContaining({ tools: expect.any(Array) }),
      }),
      expect.objectContaining({
        id: 2,
        error: expect.objectContaining({ data: expect.objectContaining({ code: 'unauthorized' }) }),
      }),
    ]),
  );
  expect(mocks.renders).not.toHaveBeenCalled();
});

it.each(['resources/read', 'prompts/get', 'future/private-method'])(
  'denies anonymous non-discovery method %s',
  async (method) => {
    const response = await POST(request(rpc(method)));
    expect(await response.json()).toMatchObject({
      id: 1,
      error: { data: { code: 'unauthorized' } },
    });
  },
);

it('rate limits anonymous requests with retry information', async () => {
  const { ApiRateLimitError } = await import('@easyrender/core');
  mocks.limit.mockRejectedValue(new ApiRateLimitError(12));
  const response = await POST(request(rpc('tools/list')));
  expect(response.status).toBe(429);
  expect(response.headers.get('retry-after')).toBe('12');
});

it('serves the exact public Glama claim without authentication or MCP dispatch', async () => {
  const { GET } = await import('@/app/api/mcp/.well-known/glama.json/route');
  const response = GET();
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('application/json');
  expect(await response.json()).toEqual({
    $schema: 'https://glama.ai/mcp/schemas/connector.json',
    claim: 'glama_claim_vcoQ3dBm9xtbCkyDzVc96fmDdt18ts5f',
  });
  expect(mocks.principal).not.toHaveBeenCalled();
  expect(mocks.limit).not.toHaveBeenCalled();
  expect(
    unstable_doesMiddlewareMatch({
      config,
      nextConfig: {},
      url: '/api/mcp/.well-known/glama.json',
    }),
  ).toBe(false);
});
