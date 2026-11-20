import { createHash } from 'node:crypto';
import { db, type Prisma, type Render } from '@easyrender/db';
import { checkNote, checkPhoto, cleanNote, RENDER_CREDITS } from '@easyrender/harness';
import { captureRender } from './analytics';
import { type Attribution, classifyCountry, normalizeAttribution } from './attribution';
import { config } from './config';
import { AppError } from './errors';
import type { RenderQuality } from './render-quality';
import { fail } from './renders-fail';
import {
  type Actor,
  assertGenerationConcurrency,
  DAY_MS,
  enforce,
  extension,
  failureContext,
  IMAGE_TYPES,
  isUncertainStart,
  lockRenderActor,
  MAX_UPLOAD_BYTES,
  type RenderSource,
  renderStage,
} from './renders-shared';
import { startSheetPrediction } from './renders-sheet';
import { reportError } from './report';
import { putFile } from './storage';

// Each preview costs a real sheet generation, so visitors get a small daily allowance.
async function assertPreviewAllowance(actor: Actor, tx: Prisma.TransactionClient) {
  const since = new Date(Date.now() - DAY_MS);
  const or = [
    actor.userId ? { userId: actor.userId } : null,
    actor.anonId ? { anonId: actor.anonId } : null,
    actor.ipHash ? { ipHash: actor.ipHash } : null,
  ].filter((clause) => clause !== null);
  if (or.length === 0) throw new AppError('Missing visitor id', 400, 'no_actor');

  const user = actor.userId
    ? await tx.user.findUnique({ where: { id: actor.userId }, select: { credits: true } })
    : null;
  const credits = user?.credits ?? 0;
  const paying = credits >= RENDER_CREDITS;
  // A paying user can always preview as many items as their balance can build, so a catalog
  // import is not capped at the daily allowance.
  const limit = paying
    ? Math.max(config.paidPreviewsPerDay(), Math.floor(credits / RENDER_CREDITS))
    : config.freePreviewsPerDay();
  // Previews that failed produced nothing, so they do not use up the allowance: an upstream outage
  // must not lock visitors out for the day.
  const used = await tx.render.count({
    where: {
      createdAt: { gte: since },
      status: { not: 'failed' },
      OR: paying ? [{ userId: actor.userId as string }] : or,
    },
  });
  if (used >= limit) {
    throw new AppError(
      paying
        ? 'Daily preview limit reached. Try again tomorrow.'
        : 'Free previews used up for today. Buy credits to keep going.',
      429,
      'preview_limit',
    );
  }
}

export async function createDraft(input: {
  actor: Actor;
  bytes: Uint8Array;
  contentType: string;
  prompt?: string | null;
  name?: string | null;
  source?: RenderSource;
  attribution?: Attribution;
  // Viewable by link from a store's product page, without being in the gallery.
  isLinkShared?: boolean;
  isPublic?: boolean;
  idempotencyKey?: string;
}): Promise<Render> {
  if (!IMAGE_TYPES.has(input.contentType)) {
    throw new AppError('Upload a JPEG, PNG or WebP photo', 415, 'bad_type');
  }
  if (input.bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new AppError('Photo is larger than 4 MB', 413, 'too_large');
  }
  enforce(checkNote(input.prompt), 400);
  const prompt = cleanNote(input.prompt) || null;
  const name = input.name?.trim().slice(0, 120) || null;
  const source = input.actor.source ?? input.source ?? 'web';
  const isPublic = input.isPublic ?? false;
  const key = input.idempotencyKey;
  if (key !== undefined && !/^[\x21-\x7e]{1,128}$/.test(key)) {
    throw new AppError(
      'Idempotency key must contain 1–128 printable ASCII characters',
      400,
      'bad_idempotency_key',
    );
  }
  const scope = input.actor.userId
    ? `user:${input.actor.userId}`
    : input.actor.anonId
      ? `anon:${input.actor.anonId}`
      : null;
  if (key && !scope)
    throw new AppError('Idempotency requires an identified caller', 400, 'no_actor');
  const requestHash = key
    ? createHash('sha256')
        .update(input.bytes)
        .update(
          JSON.stringify({
            contentType: input.contentType,
            prompt,
            name,
            isPublic,
            isLinkShared: input.isLinkShared ?? false,
          }),
        )
        .digest('hex')
    : null;
  const findReplay = async (client: Prisma.TransactionClient) => {
    if (!key || !scope) return null;
    const existing = await client.render.findUnique({
      where: { requestScope_requestKey: { requestScope: scope, requestKey: key } },
    });
    if (existing && existing.requestHash !== requestHash) {
      throw new AppError(
        'Idempotency key was already used for different input',
        409,
        'idempotency_conflict',
      );
    }
    return existing;
  };
  const replay = await findReplay(db());
  if (replay) return replay;
  // A bad photo or note is refused before a quota reservation or generation.
  const photo = enforce(await checkPhoto(input.bytes));
  const quality: RenderQuality = { photo: { ...photo.measures, warnings: photo.warnings } };
  const reservation = await db().$transaction(async (tx) => {
    await lockRenderActor(tx, input.actor);
    const existing = await findReplay(tx);
    if (existing) return { render: existing, isNew: false };
    await assertPreviewAllowance(input.actor, tx);
    await assertGenerationConcurrency(input.actor, tx);
    const render = await tx.render.create({
      data: {
        ...(input.attribution ??
          normalizeAttribution(null, config.appUrl(), classifyCountry(input.actor.geoCountry))),
        userId: input.actor.userId ?? null,
        anonId: input.actor.anonId ?? null,
        ipHash: input.actor.ipHash ?? null,
        notificationLocale: input.actor.locale,
        prompt,
        name,
        source,
        isLinkShared: input.isLinkShared ?? false,
        isPublic,
        requestScope: key ? scope : null,
        requestKey: key,
        requestHash,
        // Reservation precedes external I/O, so a retry never uploads or generates twice.
        sourceKey: 'pending:',
        quality,
        status: 'drafting',
      },
    });
    return { render, isNew: true };
  });
  let render = reservation.render;
  if (!reservation.isNew) return render;
  const ext = extension(input.contentType);
  try {
    const sourceKey = await putFile(`sources/source.${ext}`, input.bytes, input.contentType);
    const { count: sourceSaved } = await db().render.updateMany({
      where: { ...renderStage(render), sourceKey: 'pending:' },
      data: { sourceKey, status: config.sheetEnabled() ? 'drafting' : 'preview_ready' },
    });
    render = await db().render.findUniqueOrThrow({ where: { id: render.id } });
    if (!sourceSaved || !config.sheetEnabled()) return render;
    await captureRender('preview_start', render, {
      input_type: render.source === 'web' ? 'upload' : 'api',
      entry_path: render.landing_path,
      is_logged_in: Boolean(render.userId),
    });
    return await startSheetPrediction(render, {
      source: { bytes: input.bytes, contentType: input.contentType },
      fallbackStage: 'preview_start_fallback',
    });
  } catch (error) {
    // Hold only when no answer arrived (or the id could not be saved): the job may exist. A
    // received error response means it was rejected, so fail now instead of hanging.
    if (isUncertainStart(error)) {
      reportError(error, {
        renderId: render.id,
        stage: 'preview_start_uncertain',
        ...failureContext(error),
      });
      return (await db().render.findUnique({ where: { id: render.id } })) as Render;
    }
    await fail(render.id, error);
    throw new AppError('Could not start the preview. Try again in a minute.', 502, 'upstream');
  }
}
