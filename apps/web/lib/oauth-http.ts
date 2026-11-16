import 'server-only';
import { ApiRateLimitError, AppError, reportError } from '@easyrender/core';
import { NextResponse } from 'next/server';

// Public endpoints that MCP clients call from servers, and sometimes from browsers.
export const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, mcp-protocol-version',
  'access-control-max-age': '86400',
};

export const preflight = () => new Response(null, { status: 204, headers: CORS });

export const json = (data: unknown, init: ResponseInit = {}) =>
  NextResponse.json(data, {
    ...init,
    headers: { 'cache-control': 'no-store', ...CORS, ...(init.headers ?? {}) },
  });

// RFC 6749 error body.
export function oauthError(error: unknown) {
  if (error instanceof AppError) {
    return json(
      { error: error.code, error_description: error.message },
      {
        status: error.status,
        headers:
          error instanceof ApiRateLimitError ? { 'retry-after': String(error.retryAfter) } : {},
      },
    );
  }
  reportError(error);
  return json({ error: 'server_error' }, { status: 500 });
}
