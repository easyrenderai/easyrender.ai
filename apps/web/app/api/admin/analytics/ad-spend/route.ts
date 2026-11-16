import { AppError } from '@easyrender/core';
import { adminDecision, importAdvertisingSpend } from '@easyrender/core/admin-analytics';
import { revalidateTag } from 'next/cache';
import { adminSession } from '@/lib/admin-analytics/session';
import { errorResponse } from '@/lib/http';

const MAX_BYTES = 512_000;

export async function POST(request: Request): Promise<Response> {
  let response: Response;
  try {
    // Browser-session administration only; bearer credentials never bypass CSRF protection.
    if (request.headers.get('origin') !== new URL(request.url).origin)
      throw new AppError('Same-origin request required', 403, 'unauthorized_origin');
    const session = await adminSession(request.headers);
    const decision = adminDecision(session?.user ?? null, process.env.ADMIN_EMAILS ?? '', true);
    if (decision !== 'allow')
      throw new AppError(
        'Administrator access required',
        decision === 'signin' ? 401 : 403,
        'unauthorized',
      );
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
      throw new AppError('Send application/json', 415, 'bad_content_type');
    const reader = request.body?.getReader();
    if (!reader) throw new AppError('Send a JSON import', 400, 'bad_body');
    const decoder = new TextDecoder();
    let body = '',
      size = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > MAX_BYTES) {
          await reader.cancel();
          throw new AppError('Import is too large', 413, 'body_too_large');
        }
        body += decoder.decode(chunk.value, { stream: true });
      }
      body += decoder.decode();
    } finally {
      reader.releaseLock();
    }
    let input: unknown;
    try {
      input = JSON.parse(body);
    } catch {
      throw new AppError('Invalid JSON', 400, 'bad_body');
    }
    const receipt = await importAdvertisingSpend(input);
    revalidateTag('admin-analytics', { expire: 0 });
    response = Response.json(receipt);
  } catch (error) {
    response = errorResponse(error);
  }
  response.headers.set('cache-control', 'no-store');
  return response;
}
