import { expect, it, vi } from 'vitest';

vi.mock('@easyrender/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@easyrender/core')>()),
  config: { appUrl: () => 'https://easyrender.ai' },
  reportError: vi.fn(),
  resourceMetadataUrl: () => 'https://easyrender.ai/.well-known/oauth-protected-resource/api/mcp',
}));
const { AppError } = await import('@easyrender/core');
const { serveMcpRequest } = await import('./http');
const { toolError } = await import('./protocol');

// The same table sits in apps/web/lib/api-http.test.ts. Both surfaces ask isRetryable() and
// must give the answers below, so REST and MCP agree for every code.
const table: Array<[number, string, boolean]> = [
  [429, 'rate_limit', true],
  [429, 'preview_limit', true],
  [429, 'concurrent_limit', true],
  [502, 'upstream', true],
  [503, 'upstream_unavailable', true],
  [503, 'exports_unavailable', true],
  [504, 'upstream_timeout', true],
  [400, 'bad_request', false],
  [401, 'unauthorized', false],
  [402, 'insufficient_credits', false],
  [403, 'forbidden', false],
  [404, 'not_found', false],
  [409, 'conflict', false],
  [500, 'internal', false],
];

it.each(table)('MCP tool error answers %i %s with retryable %s', (status, code, retryable) => {
  expect(toolError(new AppError('x', status, code)).structuredContent).toMatchObject({
    error: { code, status, retryable },
  });
});

it.each(table)(
  'MCP HTTP error answers %i %s with retryable %s',
  async (status, code, retryable) => {
    const response = await serveMcpRequest(
      new Request('https://easyrender.ai/api/mcp'),
      async () => {
        throw new AppError('x', status, code);
      },
    );
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ error: { data: { code, status, retryable } } });
  },
);

it('answers retryable false for an unexpected error', () => {
  expect(toolError(new Error('boom')).structuredContent).toMatchObject({
    error: { code: 'internal', status: 500, retryable: false },
  });
});
