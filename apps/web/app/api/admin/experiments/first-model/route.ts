import {
  AppError,
  configureFirstModelCampaign,
  firstModelReport,
  serviceEmailAvailable,
} from '@easyrender/core';
import { adminDecision } from '@easyrender/core/admin-analytics/helpers';
import { adminSession } from '@/lib/admin-analytics/session';
import { errorResponse } from '@/lib/http';

async function authorize(request: Request) {
  const session = await adminSession(request.headers);
  const decision = adminDecision(session?.user ?? null, process.env.ADMIN_EMAILS ?? '', true);
  if (decision !== 'allow')
    throw new AppError(
      'Administrator access required',
      decision === 'signin' ? 401 : 403,
      'unauthorized',
    );
}
export async function POST(request: Request) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin)
      throw new AppError('Same-origin request required', 403, 'unauthorized_origin');
    await authorize(request);
    let received = 0;
    const stream = request.body?.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          received += chunk.byteLength;
          if (received > 4096) throw new AppError('Request too large', 413, 'too_large');
          controller.enqueue(chunk);
        },
      }),
    );
    let input: unknown;
    try {
      input = JSON.parse(stream ? await new Response(stream).text() : '');
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Invalid JSON', 400, 'bad_body');
    }
    if (
      !input ||
      typeof input !== 'object' ||
      !('isActive' in input) ||
      typeof input.isActive !== 'boolean' ||
      !('maxOffers' in input) ||
      typeof input.maxOffers !== 'number'
    )
      throw new AppError('Invalid experiment configuration', 400, 'bad_body');
    if (input.isActive && !serviceEmailAvailable())
      throw new AppError(
        'Verification emails must be available before enrollment',
        503,
        'service_email_unavailable',
      );
    return Response.json(
      await configureFirstModelCampaign({ isActive: input.isActive, maxOffers: input.maxOffers }),
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    const response = errorResponse(error);
    response.headers.set('cache-control', 'no-store');
    return response;
  }
}
export async function GET(request: Request) {
  try {
    await authorize(request);
    return Response.json(await firstModelReport(), {
      headers: {
        'cache-control': 'no-store',
        'content-disposition': 'attachment; filename="first-model-experiment.json"',
      },
    });
  } catch (error) {
    const response = errorResponse(error);
    response.headers.set('cache-control', 'no-store');
    return response;
  }
}
