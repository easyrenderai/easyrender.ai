import 'server-only';
import { AppError } from '@easyrender/core';
import { errorResponse } from '@/lib/http';

export async function mailingResponse(work: () => Promise<Response>): Promise<Response> {
  let response: Response;
  try {
    response = await work();
  } catch (error) {
    response = errorResponse(error);
  }
  response.headers.set('cache-control', 'private, no-store');
  response.headers.set('referrer-policy', 'no-referrer');
  response.headers.set('x-robots-tag', 'noindex, nofollow');
  return response;
}

export function requireMailingOrigin(request: Request): void {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    throw new AppError('Same-origin request required', 403, 'unauthorized_origin');
}

export async function mailingBody(request: Request, maxBytes = 16_384): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) throw new AppError('Request body required', 400, 'bad_body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new AppError('Request too large', 413, 'body_too_large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function mailingJson(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
    throw new AppError('Send application/json', 415, 'bad_content_type');
  const raw = await mailingBody(request);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new AppError('Invalid JSON', 400, 'bad_body');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new AppError('Send a JSON object', 400, 'bad_body');
  return body as Record<string, unknown>;
}

export function mailingToken(value: unknown): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 4096)
    throw new AppError('Invalid link', 400, 'invalid_token');
  return value;
}
