import { randomUUID } from 'node:crypto';
import { ApiRateLimitError, AppError, bearerToken, isRetryable } from '@easyrender/core';
import { errorResponse } from './http';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, idempotency-key',
  'access-control-expose-headers': 'retry-after, x-request-id',
  'access-control-max-age': '86400',
};

export const apiOptions = () => new Response(null, { status: 204, headers: CORS });

export async function apiHandle(request: Request, action: () => Promise<Response>) {
  const requestId = randomUUID();
  let response: Response;
  try {
    const origin = request.headers.get('origin');
    if (
      origin &&
      origin !== new URL(request.url).origin &&
      !['GET', 'HEAD'].includes(request.method) &&
      !bearerToken(request.headers)
    ) {
      throw new AppError('Cross-origin API calls require a bearer key', 403, 'unauthorized_origin');
    }
    response = await action();
  } catch (error) {
    response = errorResponse(error, requestId);
    const body = await response.json();
    const retryable = isRetryable(error);
    response = Response.json(
      { ...body, request_id: requestId, retryable },
      { status: response.status },
    );
    if (error instanceof ApiRateLimitError)
      response.headers.set('retry-after', String(error.retryAfter));
    else if (response.status === 429) response.headers.set('retry-after', '60');
  }
  for (const [key, value] of Object.entries(CORS)) response.headers.set(key, value);
  response.headers.set('x-request-id', requestId);
  if (!response.headers.has('cache-control')) response.headers.set('cache-control', 'no-store');
  return response;
}
