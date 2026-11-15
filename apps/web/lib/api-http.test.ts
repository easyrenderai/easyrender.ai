import { expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { ApiRateLimitError } from '@easyrender/core';
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
