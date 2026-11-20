import { expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { ApiRateLimitError, AppError } from '@easyrender/core';
import { apiHandle, apiOptions } from './api-http';

it('returns a machine-readable rate limit with retry delay and request correlation', async () => {
  const response = await apiHandle(new Request('https://easyrender.ai/api/credits'), async () => {
    throw new ApiRateLimitError(17);
  });
  expect(response.status).toBe(429);
  expect(response.headers.get('retry-after')).toBe('17');
  expect(response.headers.get('access-control-allow-origin')).toBe('*');
  expect(await response.json()).toMatchObject({
    code: 'rate_limit',
    retryable: true,
    request_id: response.headers.get('x-request-id'),
  });
});
it('refuses cross-origin cookie-only mutations before executing them', async () => {
  const action = vi.fn(async () => Response.json({ ok: true }));
  const response = await apiHandle(
    new Request('https://easyrender.ai/api/renders', {
      method: 'POST',
      headers: { origin: 'https://example.com' },
    }),
    action,
  );
  expect(response.status).toBe(403);
  expect(action).not.toHaveBeenCalled();
});
it('allows browser bearer calls without allowing cross-origin cookies', async () => {
  const response = await apiHandle(
    new Request('https://easyrender.ai/api/credits', {
      headers: { origin: 'https://example.com', authorization: 'Bearer test' },
    }),
    async () => Response.json({ balance: 3 }),
  );
  expect(response.status).toBe(200);
  expect(apiOptions().headers.get('access-control-allow-headers')).toContain('idempotency-key');
  expect(response.headers.get('access-control-allow-credentials')).toBeNull();
});

// The same table sits in packages/mcp/src/retryable-contract.test.ts. Both surfaces ask
// isRetryable() and must give the answers below, so REST and MCP agree for every code.
it.each([
  [429, 'rate_limit', true],
  [429, 'preview_limit', true],
  [429, 'concurrent_limit', true],
  [502, 'upstream', true],
  [503, 'upstream_unavailable', true],
  [503, 'exports_unavailable', true],
  [504, 'upstream_timeout', true],
  [503, 'no_stripe', false],
  [503, 'not_configured', false],
  [400, 'bad_request', false],
  [401, 'unauthorized', false],
  [402, 'insufficient_credits', false],
  [403, 'forbidden', false],
  [404, 'not_found', false],
  [409, 'conflict', false],
  [500, 'internal', false],
])('REST answers %i %s with retryable %s', async (status, code, retryable) => {
  const response = await apiHandle(new Request('https://easyrender.ai/api/credits'), async () => {
    throw new AppError('x', status, code);
  });
  expect(response.status).toBe(status);
  expect(await response.json()).toMatchObject({ code, retryable });
});

it('answers retryable false for an unexpected error', async () => {
  const response = await apiHandle(new Request('https://easyrender.ai/api/credits'), async () => {
    throw new Error('boom');
  });
  expect(response.status).toBe(500);
  expect(await response.json()).toMatchObject({ code: 'internal', retryable: false });
});
