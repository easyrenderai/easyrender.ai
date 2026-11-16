import { AppError, startBuild, toView } from '@easyrender/core';
import { NextResponse } from 'next/server';
import { resolveActor } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

export const maxDuration = 60;

// Spends the render credits and starts the 3D build from the approved preview.
export const POST = (request: Request, { params }: RouteContext<'/api/renders/[id]/render'>) =>
  apiHandle(request, async () => {
    const { id } = await params;
    const actor = await resolveActor(request.headers, 'spend');
    if (!actor.userId) throw new AppError('Sign up to render in 3D', 401, 'unauthorized');
    let received = 0;
    const bounded = request.body?.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          received += chunk.byteLength;
          if (received > 4096) throw new AppError('Build request exceeds 4 KiB', 413, 'too_large');
          controller.enqueue(chunk);
        },
      }),
    );
    const text = bounded ? await new Response(bounded).text() : '';
    let maxCredits: number | undefined;
    let isUsingFreeModel = false;
    if (text.trim()) {
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        throw new AppError('Send a JSON object with optional maxCredits', 400, 'bad_body');
      }
      if (!body || typeof body !== 'object' || Array.isArray(body))
        throw new AppError('Send a JSON object with optional maxCredits', 400, 'bad_body');
      const value = (body as Record<string, unknown>).maxCredits;
      const trial = (body as Record<string, unknown>).useFreeModel;
      if (trial !== undefined && typeof trial !== 'boolean')
        throw new AppError('useFreeModel must be a boolean', 400, 'bad_body');
      isUsingFreeModel = trial === true;
      if (value !== undefined) {
        if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
          throw new AppError(
            'maxCredits must be a non-negative safe integer',
            400,
            'bad_max_credits',
          );
        maxCredits = value;
      }
    }
    return NextResponse.json(
      toView(await startBuild(id, { ...actor, maxCredits, isUsingFreeModel })),
    );
  });

export const OPTIONS = apiOptions;
