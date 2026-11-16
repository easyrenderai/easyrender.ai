import { randomUUID } from 'node:crypto';
import {
  type Actor,
  ApiRateLimitError,
  AppError,
  reportError,
  resourceMetadataUrl,
} from '@easyrender/core';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { isJSONRPCRequest } from '@modelcontextprotocol/sdk/types.js';
import { createMcpServer } from './index';
import { MCP_UNAUTHORIZED_MESSAGE } from './protocol';

// Fail closed for new methods. Resources/prompts are not currently implemented.
const ANONYMOUS_METHODS = new Set([
  'initialize',
  'notifications/initialized',
  'ping',
  'tools/list',
]);

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, GET, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, mcp-protocol-version, accept',
  'access-control-expose-headers':
    'www-authenticate, mcp-protocol-version, retry-after, x-request-id',
  'access-control-max-age': '86400',
  'cache-control': 'no-store',
};
function isAllowedOrigin(value: string | null): boolean {
  if (value === null) return true; // Native/server clients do not send Origin.
  try {
    const url = new URL(value);
    if (url.origin !== value || url.username || url.password) return false;
    return (
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    );
  } catch {
    return false;
  }
}
function failure(
  status: number,
  message: string,
  code: string,
  headers: Record<string, string> = {},
) {
  return Response.json(
    {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32000,
        message,
        data: { code, status, retryable: [429, 502, 503, 504].includes(status) },
      },
    },
    { status, headers: { ...CORS, ...headers } },
  );
}

export type McpActor = Actor & { userId: string };
export type ResolveMcpActor = (request: Request) => Promise<McpActor | null>;

// Execution only accepts an explicitly supplied bearer token, never browser session cookies.
// Any HTTPS client origin can use its own key; credentials/cookies are never enabled through CORS.
export async function serveMcpRequest(
  request: Request,
  resolveActor: ResolveMcpActor,
): Promise<Response> {
  const requestId = randomUUID();
  const requestHeaders = { 'x-request-id': requestId };
  if (!isAllowedOrigin(request.headers.get('origin')))
    return failure(403, 'Origin is not allowed', 'invalid_origin', requestHeaders);
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: { ...CORS, ...requestHeaders } });
  let server: ReturnType<typeof createMcpServer> | undefined;
  try {
    const actor = await resolveActor(request);
    if (!actor && request.method !== 'POST')
      return failure(401, MCP_UNAUTHORIZED_MESSAGE, 'unauthorized', {
        ...requestHeaders,
        'www-authenticate': `Bearer resource_metadata="${resourceMetadataUrl()}"`,
      });
    // No standalone stream or session exists to read/delete in this stateless JSON transport.
    if (request.method !== 'POST')
      return failure(405, 'Use POST for stateless MCP requests', 'method_not_allowed', {
        ...requestHeaders,
        allow: 'POST, OPTIONS',
      });
    server = createMcpServer(actor ?? {});
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
      maxRequestBodySize: 4 * 1024 * 1024,
    });
    await server.connect(transport);
    let hasUnauthorizedRequest = false;
    if (!actor) {
      // Let the SDK bound/validate the body first. Gate each message, including batches,
      // before dispatch so no present or future private method can run anonymously.
      const dispatch = transport.onmessage;
      transport.onmessage = (message, extra) => {
        if ('method' in message && ANONYMOUS_METHODS.has(message.method)) {
          dispatch?.(message, extra);
        } else if (isJSONRPCRequest(message)) {
          hasUnauthorizedRequest = true;
          void transport
            .send({
              jsonrpc: '2.0',
              id: message.id,
              error: {
                code: -32000,
                message: MCP_UNAUTHORIZED_MESSAGE,
                data: { code: 'unauthorized', status: 401, retryable: false },
              },
            })
            .catch((error: unknown) => reportError(error, { stage: 'mcp-auth', requestId }));
        }
        // Non-discovery notifications/responses are ignored, never dispatched.
      };
    }
    const response = await transport.handleRequest(request);
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries({ ...CORS, ...requestHeaders }))
      headers.set(key, value);
    // Preserve OAuth's HTTP challenge while returning the correlated JSON-RPC error.
    if (hasUnauthorizedRequest)
      headers.set('www-authenticate', `Bearer resource_metadata="${resourceMetadataUrl()}"`);
    // JSON mode resolves only after the request's complete response has been serialized.
    return new Response(response.body, {
      status: hasUnauthorizedRequest ? 401 : response.status,
      headers,
    });
  } catch (error) {
    if (error instanceof AppError)
      return failure(error.status, error.message, error.code, {
        ...requestHeaders,
        ...(error instanceof ApiRateLimitError ? { 'retry-after': String(error.retryAfter) } : {}),
      });
    reportError(error, { stage: 'mcp-http', requestId });
    return failure(
      500,
      'MCP request failed. Check the render status before retrying a mutation.',
      'internal',
      requestHeaders,
    );
  } finally {
    await server?.close().catch((error: unknown) => reportError(error, { stage: 'mcp-close' }));
  }
}
