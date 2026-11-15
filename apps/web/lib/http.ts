import 'server-only';
import { AppError, reportError } from '@easyrender/core';
import { NextResponse } from 'next/server';

export function errorResponse(error: unknown, requestId?: string) {
  const context: Record<string, string> = requestId ? { request_id: requestId } : {};
  if (error instanceof AppError) {
    // 4xx is the caller's doing. A 502 'upstream' was already reported where it was caught.
    if (error.status >= 500 && error.code !== 'upstream') reportError(error, context);
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  reportError(error, context);
  return NextResponse.json({ error: 'Something went wrong', code: 'internal' }, { status: 500 });
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    return errorResponse(error);
  }
}
