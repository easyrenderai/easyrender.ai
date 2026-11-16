import { createHash } from 'node:crypto';
import { AppError, consumeApiRateLimit, registerClient } from '@easyrender/core';
import { json, oauthError, preflight } from '@/lib/oauth-http';

// Registration is open on purpose (MCP clients register themselves), so it is capped per source
// address. Registrations are stateless signed ids: nothing is stored, but the cap keeps the
// endpoint from being used as a free signing oracle. The limit is generous because hosted MCP
// clients register from shared addresses.
const REGISTER_LIMIT_PER_MINUTE = 60;
const MAX_BODY_BYTES = 16 * 1024;

// RFC 7591 dynamic client registration: MCP clients register themselves before asking a user.
export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    await consumeApiRateLimit(
      `oauth-register:${createHash('sha256').update(ip).digest('hex')}`,
      REGISTER_LIMIT_PER_MINUTE,
    );
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      throw new AppError('Registration is too large', 413, 'invalid_client_metadata');
    }
    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {}
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new AppError('Send a JSON client registration', 400, 'invalid_client_metadata');
    }
    return json(registerClient(body), { status: 201 });
  } catch (error) {
    return oauthError(error);
  }
}

export const OPTIONS = preflight;
