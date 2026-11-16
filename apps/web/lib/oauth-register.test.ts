import { ApiRateLimitError } from '@easyrender/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.BETTER_AUTH_SECRET = 'test-secret-test-secret-test-secret';

vi.mock('server-only', () => ({}));

const limit = vi.hoisted(() => vi.fn());
vi.mock('@easyrender/core', async (original) => ({
  ...(await original<typeof import('@easyrender/core')>()),
  consumeApiRateLimit: limit,
}));

import { POST } from '@/app/api/oauth/register/route';

const post = (body: string, ip = '192.0.2.7') =>
  POST(
    new Request('https://easyrender.ai/api/oauth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body,
    }),
  );
const registration = (uri: string) =>
  JSON.stringify({ client_name: 'Claude', redirect_uris: [uri] });

describe('POST /api/oauth/register', () => {
  beforeEach(() => limit.mockReset());

  it('still registers an unknown client without credentials (MCP clients self-register)', async () => {
    const response = await post(registration('https://claude.ai/api/mcp/auth_callback'));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      client_name: 'Claude',
      token_endpoint_auth_method: 'none',
    });
    expect((await post(registration('http://localhost:6274/callback'))).status).toBe(201);
  });

  it('refuses insecure, wildcard and malformed registrations', async () => {
    for (const body of [
      registration('http://evil.example.com/cb'),
      registration('https://*.example.com/cb'),
      registration('https://claude.ai@evil.example.com/cb'),
      '[]',
      'not json',
    ]) {
      expect((await post(body)).status).toBe(400);
    }
    expect((await post(`{"pad":"${'x'.repeat(20_000)}"}`)).status).toBe(413);
  });

  it('answers 429 with Retry-After once the source address is over its limit', async () => {
    limit.mockRejectedValueOnce(new ApiRateLimitError(42));
    const response = await post(registration('https://attacker.example.com/cb'));
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('42');
    expect(await response.json()).toMatchObject({ error: 'rate_limit' });
  });

  it('counts per hashed source address, not the raw address', async () => {
    await post(registration('https://claude.ai/api/mcp/auth_callback'), '198.51.100.9');
    const [subject] = limit.mock.calls[0] as [string];
    expect(subject).toMatch(/^oauth-register:[0-9a-f]{64}$/);
    expect(subject).not.toContain('198.51.100.9');
  });
});
