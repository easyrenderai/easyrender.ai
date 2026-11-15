import {
  AppError,
  assertActorScope,
  bearerToken,
  createDraft,
  getBalance,
  listLibrary,
  listRenderPage,
  toView,
} from '@easyrender/core';
import { normalizeAttribution } from '@easyrender/core/attribution';
import { RenderStatus } from '@easyrender/db';
import { NextResponse } from 'next/server';
import { resolveActor } from '@/lib/actor';
import { privacyRegion } from '@/lib/analytics/privacy-region';
import { apiHandle, apiOptions } from '@/lib/api-http';
import { parseApiPhoto } from '@/lib/api-upload';

export const maxDuration = 60;

// Multipart upload: `image` (file), an optional `prompt` and an optional catalog `name`. Starts the free preview.
export const POST = (request: Request) =>
  apiHandle(request, async () => {
    const actor = await resolveActor(request.headers, 'write');
    const photo = await parseApiPhoto(request, actor);
    if (photo.isPublic) assertActorScope(actor, 'share');
    let attribution: unknown = photo.attribution ?? null;
    if (typeof attribution === 'string') {
      try {
        attribution = JSON.parse(attribution);
      } catch {
        attribution = null;
      }
    }
    const render = await createDraft({
      actor,
      attribution: normalizeAttribution(
        attribution,
        new URL(request.url).origin,
        privacyRegion(request.headers),
      ),
      bytes: photo.bytes,
      contentType: photo.contentType,
      prompt: photo.prompt,
      name: photo.name,
      isPublic: photo.isPublic,
      idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
      source: bearerToken(request.headers) ? 'api' : 'web',
    });
    return NextResponse.json(toView(render), { status: 201 });
  });

// The signed-in user's catalog, for the library grid.
export const GET = (request: Request) =>
  apiHandle(request, async () => {
    const actor = await resolveActor(request.headers);
    if (!actor.userId) throw new AppError('Sign in to see your library', 401, 'unauthorized');
    const query = new URL(request.url).searchParams;
    const status = query.get('status');
    if (status !== null && !Object.values(RenderStatus).includes(status as RenderStatus))
      throw new AppError('Unknown render status', 400, 'bad_status');
    if (actor.apiKeyId || ['cursor', 'limit', 'status'].some((key) => query.has(key))) {
      const [page, balance] = await Promise.all([
        listRenderPage(actor.userId, {
          limit: query.has('limit') ? Number(query.get('limit')) : 25,
          cursor: query.get('cursor') ?? undefined,
          status: (status as RenderStatus | null) ?? undefined,
        }),
        getBalance(actor.userId),
      ]);
      return NextResponse.json({
        renders: page.renders.map(toView),
        balance,
        nextCursor: page.nextCursor,
      });
    }
    const [renders, balance] = await Promise.all([
      listLibrary(actor.userId),
      getBalance(actor.userId),
    ]);
    return NextResponse.json({ renders: renders.map(toView), balance });
  });

export const OPTIONS = apiOptions;
