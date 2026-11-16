import { createHash } from 'node:crypto';
import { db, type Prisma, type Render } from '@easyrender/db';
import {
  BUILD_MODEL,
  buildCostUsd,
  buildRequest,
  type Check,
  checkGlb,
  checkNote,
  checkPhoto,
  checkSheet,
  cleanNote,
  createReplicate,
  cutCells,
  DEFAULT_FINAL_SHEET_SETTINGS,
  download,
  FALLBACK_SHEET_SETTINGS,
  FINAL_SHEET_CREDITS,
  FINAL_SHEET_MODEL,
  findGlbUrl,
  isSettled,
  loadHarness,
  type Passed,
  type Prediction,
  ProviderRequestError,
  RENDER_CREDITS,
  SHEET_CREDITS,
  SHEET_MODEL,
  selectMaterialsFrom,
  selectSkillFrom,
  sheetOutputUrl,
  sheetRequest,
  UPSCALE_CREDITS,
} from '@easyrender/harness';
import { captureRender } from './analytics';
import { type Attribution, classifyCountry, normalizeAttribution } from './attribution';
import { config } from './config';
import { grantCreditsInTransaction, spendCreditsInTransaction } from './credits';
import { AppError, notFound } from './errors';
import { grantFirstModelInTransaction } from './first-model-experiment';
import { type RenderEditView, toEditView } from './render-edits';
import { finishMaterialFidelity } from './render-fidelity';
import { type RenderQuality, withQuality } from './render-quality';
import { reportError } from './report';
import { queueRenderServiceEmail } from './service-email';
import { getFile, putFile } from './storage';

// Who is asking: a signed-in user, an anonymous visitor (cookie), or both.
export type Actor = {
  userId?: string | null;
  anonId?: string | null;
  ipHash?: string | null;
  geoCountry?: string | null;
  apiKeyId?: string;
  apiKeyScopes?: string[];
  maxCredits?: number;
  isUsingFreeModel?: boolean;
  // Transport that creates the generation; credentials alone do not distinguish API from MCP.
  source?: RenderSource;
};

// The caller's explicit spend ceiling is checked again inside the debit transaction.
export function assertAuthorizedCredits(amount: number, actor: Actor) {
  if (actor.maxCredits === undefined) return;
  if (!Number.isSafeInteger(actor.maxCredits) || actor.maxCredits < 0) {
    throw new AppError('Credit limit must be a non-negative integer', 400, 'bad_max_credits');
  }
  if (amount > actor.maxCredits) {
    throw new AppError(
      'This operation exceeds the authorized credit limit',
      409,
      'budget_exceeded',
    );
  }
}

export type RenderSource = 'web' | 'mcp' | 'api';

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DAY_MS = 24 * 60 * 60 * 1000;
// A sheet takes ~1 minute and a 3D build ~2: anything still running after this has been lost.
const STALE_MS = 45 * 60 * 1000;
// A start request lasts under a minute. A render with no prediction id after this long never
// reached Replicate, so it fails and refunds instead of leaving the visitor waiting.
const NEVER_STARTED_MS = 3 * 60 * 1000;
export const MAX_ACTIVE_RENDERS = 5;
const POLL_INTERVAL_MS = 5000;

const harness = () => loadHarness({ token: config.harnessToken() });
const replicate = () => createReplicate(config.replicateToken());
// What the sheet prompt is told about the object: the owner's fix note first (so the length cap
// never cuts it), then their original prompt.
const sheetNotes = (render: Pick<Render, 'prompt' | 'sheetNote'>) =>
  cleanNote([render.sheetNote, render.prompt].filter(Boolean).join('. ')) || null;
export const extension = (contentType: string) =>
  contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';

export function canAccess(render: Pick<Render, 'userId' | 'anonId'>, actor: Actor): boolean {
  if (render.userId) return render.userId === actor.userId;
  return Boolean(render.anonId && render.anonId === actor.anonId);
}

// Finished renders are in the public gallery unless their owner hid them.
export const isListed = (render: Pick<Render, 'isPublic' | 'status' | 'glbKey'>) =>
  render.isPublic && render.status === 'ready' && Boolean(render.glbKey);

// A store's product page embeds its models by link, so a finished link-shared render is viewable
// by anyone who has the link even though it is not in the gallery.
export const isShared = (render: Pick<Render, 'isLinkShared' | 'status' | 'glbKey'>) =>
  render.isLinkShared && render.status === 'ready' && Boolean(render.glbKey);

export const canView = (render: Render, actor: Actor) =>
  canAccess(render, actor) || isListed(render) || isShared(render);

// Turns a failed harness check into the API error the caller sees.
function enforce<M>(check: Check<M>, status = 422): Passed<M> {
  if (!check.ok) throw new AppError(check.message, status, check.code);
  return check;
}

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

export async function lockRenderActor(tx: Prisma.TransactionClient, actor: Actor) {
  const identities = [
    actor.userId ? `user:${actor.userId}` : null,
    actor.anonId ? `anon:${actor.anonId}` : null,
    actor.ipHash ? `ip:${actor.ipHash}` : null,
  ]
    .filter((identity): identity is string => Boolean(identity))
    .sort();
  if (!identities.length) throw new AppError('Missing visitor id', 400, 'no_actor');
  for (const identity of identities) {
    const key = createHash('sha256').update(`render-quota:${identity}`).digest().readBigInt64BE();
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key})`;
  }
}

export async function assertGenerationConcurrency(actor: Actor, tx: Prisma.TransactionClient) {
  const owner = actor.userId
    ? { userId: actor.userId }
    : actor.anonId
      ? { anonId: actor.anonId }
      : { ipHash: actor.ipHash ?? '' };
  const [renders, viewSets, upscales] = await Promise.all([
    tx.render.count({ where: { ...owner, status: { in: ['drafting', 'rendering'] } } }),
    actor.userId
      ? tx.viewSet.count({
          where: { userId: actor.userId, status: { in: ['drafting', 'processing'] } },
        })
      : 0,
    actor.userId ? tx.upscale.count({ where: { userId: actor.userId, status: 'processing' } }) : 0,
  ]);
  if (renders + viewSets + upscales >= MAX_ACTIVE_RENDERS) {
    throw new AppError(
      'Too many active generations. Wait for one to finish.',
      429,
      'concurrent_limit',
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
  const isPublic = input.isPublic ?? (!input.isLinkShared && source === 'web');
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
    const client = replicate();
    const sourceUrl = await client.upload(input.bytes, `source.${ext}`, input.contentType);
    const recipe = await harness();
    const request = sheetRequest(
      sourceUrl,
      prompt,
      selectSkillFrom(recipe.skills, render.name, prompt),
      recipe.sheet,
      recipe.sheetPrompt,
      selectMaterialsFrom(recipe.materials, render.name, prompt),
    );
    const webhook = config.webhookUrl(`/api/webhooks/replicate?render=${render.id}`);
    let prediction: Prediction;
    try {
      prediction = await client.start(request.path, request.body, webhook);
    } catch (error) {
      // Replicate answered with a server error for the Lite draw. Try the sturdier model once
      // (a different request, not a replay) so the visitor still gets a preview.
      if (!(error instanceof ProviderRequestError) || (error.status ?? 0) < 500) throw error;
      reportError(error, {
        renderId: render.id,
        stage: 'preview_start_fallback',
        ...failureContext(error),
      });
      const fallback = sheetRequest(
        sourceUrl,
        prompt,
        selectSkillFrom(recipe.skills, render.name, prompt),
        FALLBACK_SHEET_SETTINGS,
        recipe.sheetPrompt,
        selectMaterialsFrom(recipe.materials, render.name, prompt),
      );
      prediction = await client.start(fallback.path, fallback.body, webhook);
    }
    return await persistStartedPrediction(render, { sheetPredictionId: prediction.id });
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

// Fence a generation, while allowing unrelated visibility/metadata edits to coexist.
// In particular, drafting is reused by paid redraws and is not a unique generation identity.
function renderStage(render: Render) {
  return {
    id: render.id,
    status: render.status,
    sheetRedraws: render.sheetRedraws,
    sheetPredictionId: render.sheetPredictionId,
    finalSheetPredictionId: render.finalSheetPredictionId,
    buildPredictionId: render.buildPredictionId,
    buildClaimedAt: render.buildClaimedAt,
  };
}

async function persistStartedPrediction(
  render: Render,
  data: Prisma.RenderUpdateManyMutationInput,
) {
  try {
    await db().render.updateMany({ where: renderStage(render), data });
    return await db().render.findUniqueOrThrow({ where: { id: render.id } });
  } catch (error) {
    reportError(error, { renderId: render.id, stage: 'prediction_start_persistence' });
    // The provider accepted the job. A storage outage must not refund it or authorize a duplicate.
    throw new ProviderRequestError('Provider accepted the job but its id could not be saved', true);
  }
}

// What kind of provider failure this is, so a rejected request is told apart from an outage:
// `input` (4xx the provider will keep rejecting), `auth` (token or billing), `outage` (5xx) or
// `no_response` (no answer at all). Not a provider error: `other`.
function providerFailureKind(error: unknown): string {
  if (!(error instanceof ProviderRequestError)) return 'other';
  if (error.status === undefined) return 'no_response';
  if ([401, 402, 403].includes(error.status)) return 'auth';
  return error.status >= 500 ? 'outage' : 'input';
}

// A start whose outcome is unknown: no answer arrived (or the id could not be saved), so the job
// may exist and must not be replayed or refunded. An error response Replicate did send (even a
// 5xx) means it was rejected, so the render fails and refunds now instead of waiting for the
// never-started timeout.
function isUncertainStart(error: unknown): error is ProviderRequestError {
  return error instanceof ProviderRequestError && error.isAmbiguous && error.status === undefined;
}

function failureContext(error: unknown): Record<string, string> {
  return error instanceof ProviderRequestError
    ? { failureKind: providerFailureKind(error), providerStatus: String(error.status ?? 'none') }
    : {};
}

async function fail(id: string, error: unknown, expected?: Pick<Render, 'status' | 'updatedAt'>) {
  const message = error instanceof Error ? error.message : String(error);
  // A render that timed out or never started is an expected lifecycle end: it is refunded and
  // shown as failed, so it is a warning that names the stage, not an unhandled exception.
  if (error instanceof TerminalRenderError) {
    reportError(
      error,
      { renderId: id, stage: error.stage ?? 'render_terminal', ...failureContext(error) },
      'warning',
    );
  } else {
    reportError(error, { renderId: id, stage: 'render', ...failureContext(error) });
  }
  const render = await db().render.findUnique({ where: { id } });
  if (!render || !['drafting', 'rendering'].includes(render.status)) return;
  // The terminal state and refund commit together. If any wallet/ledger write fails, the
  // render remains in flight and a webhook, polling request or recovery worker can retry.
  const changed = await db().$transaction(async (tx) => {
    const isRedraw = render.status === 'drafting' && Boolean(render.sheetKey);
    const { count } = await tx.render.updateMany({
      where: {
        id,
        status: expected?.status ?? render.status,
        updatedAt: expected?.updatedAt ?? render.updatedAt,
      },
      data: isRedraw
        ? { status: 'preview_ready', error: null }
        : { status: 'failed', error: message.slice(0, 500) },
    });
    if (!count) return false;
    const amount = isRedraw ? SHEET_CREDITS : render.credits;
    if (render.userId && amount > 0) {
      await grantCreditsInTransaction(tx, {
        userId: render.userId,
        amount,
        key: isRedraw ? `refund:${id}:redraw:${render.sheetRedraws}` : `refund:${id}`,
        reason: isRedraw ? 'sheet_redraw_failed' : 'render_failed',
        renderId: id,
      });
    }
    if (!isRedraw) await queueRenderServiceEmail(id, tx);
    return true;
  });
  if (!changed || (render.status === 'drafting' && render.sheetKey)) return;
  await captureRender(
    render.status === 'drafting' ? 'preview_failed' : 'render_failed',
    render,
    render.status === 'drafting'
      ? {
          failure_reason: 'generation_failed',
          duration_ms: Date.now() - render.createdAt.getTime(),
          input_type: render.source === 'web' ? 'upload' : 'api',
          free_preview_consumed: false,
        }
      : {
          model_id: render.id,
          failure_reason: 'generation_failed',
          duration_ms: Date.now() - render.updatedAt.getTime(),
          credits_spent: render.credits,
          credits_refunded: render.userId ? render.credits : 0,
        },
  );
}

class TerminalRenderError extends Error {
  constructor(
    message: string,
    // Which lifecycle step ended the render, for diagnostics.
    readonly stage?: string,
  ) {
    super(message);
  }
}

// Moves a render forward if its Replicate job finished. Called by polling and by the webhook;
// it always re-reads the prediction from Replicate, so it is safe to call with any input.
export async function advance(id: string): Promise<Render | null> {
  const render = await db().render.findUnique({ where: { id } });
  if (!render) return null;
  if (!['drafting', 'rendering'].includes(render.status)) return render;

  const age = Date.now() - render.updatedAt.getTime();
  const stale = age > STALE_MS;
  const isUnstarted = age > NEVER_STARTED_MS;

  try {
    // Never started (the request died between claiming the render and starting Replicate).
    if (
      isUnstarted &&
      ((render.status === 'drafting' && !render.sheetPredictionId) ||
        (render.status === 'rendering' &&
          !render.finalSheetPredictionId &&
          !render.buildPredictionId))
    ) {
      throw new TerminalRenderError(
        'never started',
        render.status === 'drafting' ? 'preview_never_started' : 'build_never_started',
      );
    }
    // The final sheet was drawn but the 3D build never started (the worker died in between).
    if (
      stale &&
      render.status === 'rendering' &&
      render.buildClaimedAt &&
      !render.buildPredictionId
    ) {
      throw new TerminalRenderError('3D render never started', 'build_never_started');
    }
    if (render.status === 'drafting' && render.sheetPredictionId) {
      const prediction = await replicate().get(render.sheetPredictionId);
      if (!isSettled(prediction.status)) {
        if (stale) throw new TerminalRenderError('angle sheet timed out');
        return render;
      }
      const url = prediction.status === 'succeeded' ? sheetOutputUrl(prediction.output) : null;
      if (!url) throw new TerminalRenderError(prediction.error ?? `sheet ${prediction.status}`);
      const sheet = await download(url);
      const quality = await checkSheet(sheet, (await harness()).limits);
      if (!quality.ok)
        throw new TerminalRenderError(`sheet rejected (${quality.code}): ${quality.message}`);
      const sheetKey = await putFile('sheets/sheet.png', sheet, 'image/png');
      const previewCompletedAt = render.previewCompletedAt ?? (render.sheetKey ? null : new Date());
      const { count } = await db().render.updateMany({
        where: renderStage(render),
        data: {
          status: 'preview_ready',
          previewCompletedAt,
          sheetKey,
          quality: withQuality(render, {
            draftSheet: { ...quality.measures, warnings: quality.warnings },
          }),
          costUsd: { increment: SHEET_MODEL.costUsd },
        },
      });
      if (count === 0) return db().render.findUnique({ where: { id } });
      // A redraw is not a new preview: it was never counted as one, nor does it use the allowance.
      const isRedraw = Boolean(render.sheetKey);
      const duration = Date.now() - render.createdAt.getTime();
      if (!isRedraw)
        try {
          const used = await db().render.count({
            where: {
              createdAt: { gte: new Date(Date.now() - DAY_MS) },
              status: { not: 'failed' },
              OR: [
                ...(render.userId ? [{ userId: render.userId }] : []),
                ...(render.anonId ? [{ anonId: render.anonId }] : []),
                ...(render.ipHash ? [{ ipHash: render.ipHash }] : []),
              ],
            },
          });
          await captureRender(
            'preview_ready',
            render,
            {
              duration_ms: duration,
              free_previews_left_today: Math.max(0, config.freePreviewsPerDay() - used),
            },
            { occurredAt: previewCompletedAt ?? undefined },
          );
        } catch {
          reportError(new Error('Unable to record preview analytics'), { component: 'analytics' });
        }
    }

    // A paid build redraws the sheet with the final model first; when it is done, the 3D build starts.
    if (
      render.status === 'rendering' &&
      render.finalSheetPredictionId &&
      !render.buildPredictionId
    ) {
      const prediction = await replicate().get(render.finalSheetPredictionId);
      if (!isSettled(prediction.status)) {
        if (stale) throw new TerminalRenderError('final angle sheet timed out');
        return render;
      }
      // A final sheet that failed or was rejected never fails the build: it carries on from the
      // draft the visitor already saw, and the problem is reported.
      let finalSheet: Uint8Array | null = null;
      let finalMeasures: RenderQuality['finalSheet'];
      let finalProblem = 'redraw_failed';
      try {
        const url = prediction.status === 'succeeded' ? sheetOutputUrl(prediction.output) : null;
        if (!url)
          throw new TerminalRenderError(prediction.error ?? `final sheet ${prediction.status}`);
        const bytes = await download(url);
        const quality = await checkSheet(bytes, (await harness()).limits);
        if (!quality.ok) {
          finalProblem = quality.code;
          throw new TerminalRenderError(`sheet rejected (${quality.code}): ${quality.message}`);
        }
        finalSheet = bytes;
        finalMeasures = { ...quality.measures, warnings: quality.warnings };
      } catch (error) {
        if (!(error instanceof TerminalRenderError)) throw error;
        reportError(error, { renderId: id, stage: 'final_sheet' });
      }
      const finalKey = finalSheet
        ? await putFile('sheets/sheet.png', finalSheet, 'image/png')
        : null;
      // Only the call that wins this claim starts the build, so webhook and polling cannot both.
      const claimedAt = new Date();
      const { count } = await db().render.updateMany({
        where: { ...renderStage(render), buildPredictionId: null, buildClaimedAt: null },
        data: {
          buildClaimedAt: claimedAt,
          quality: withQuality(
            render,
            finalMeasures
              ? { finalSheet: finalMeasures, isDraftUsed: false }
              : { isDraftUsed: true, finalSheetProblem: finalProblem },
          ),
          ...(finalKey
            ? { sheetKey: finalKey, costUsd: { increment: FINAL_SHEET_MODEL.costUsd } }
            : {}),
        },
      });
      if (count === 0) return db().render.findUnique({ where: { id } });
      const sheetForBuild = finalSheet ?? (render.sheetKey ? await getFile(render.sheetKey) : null);
      const started = await startThreeD(id, render.sourceKey, sheetForBuild);
      return persistStartedPrediction(
        { ...render, buildClaimedAt: claimedAt },
        { buildPredictionId: started.id },
      );
    }

    if (render.status === 'rendering' && render.buildPredictionId) {
      const prediction = await replicate().get(render.buildPredictionId);
      if (!isSettled(prediction.status)) {
        if (stale) throw new TerminalRenderError('3D render timed out');
        return render;
      }
      const url = prediction.status === 'succeeded' ? findGlbUrl(prediction.output) : null;
      if (!url)
        throw new TerminalRenderError(
          prediction.error ?? `${BUILD_MODEL.name} ${prediction.status}`,
        );
      const glb = await download(url);
      const quality = checkGlb(glb);
      if (!quality.ok)
        throw new TerminalRenderError(`model rejected (${quality.code}): ${quality.message}`);
      const finished = await finishMaterialFidelity(glb, render);
      const glbKey = await putFile('models/model.glb', finished.bytes, 'model/gltf-binary');
      const completedAt = render.completedAt ?? new Date();
      const { count } = await db().$transaction(async (tx) => {
        const result = await tx.render.updateMany({
          where: renderStage(render),
          data: {
            status: 'ready',
            completedAt,
            glbKey,
            quality: withQuality(render, {
              glb: { ...quality.measures, bytes: finished.bytes.byteLength },
              fidelity: finished.fidelity,
            }),
            costUsd: { increment: buildCostUsd(prediction.metrics?.predict_time) },
          },
        });
        if (result.count) await queueRenderServiceEmail(id, tx);
        return result;
      });
      if (count)
        await captureRender(
          'render_ready',
          render,
          {
            model_id: id,
            duration_ms: Date.now() - (render.buildClaimedAt ?? render.updatedAt).getTime(),
            in_public_gallery: render.isPublic,
            formats: 'glb,usdz',
          },
          { occurredAt: completedAt },
        );
    }
  } catch (error) {
    const current = await db().render.findUnique({ where: { id }, select: { status: true } });
    if (
      (error instanceof TerminalRenderError || stale) &&
      (current?.status === 'drafting' || current?.status === 'rendering')
    ) {
      await fail(id, error, render);
    } else {
      reportError(error, { renderId: id, stage: 'render_poll_retryable' });
    }
  }
  return db().render.findUnique({ where: { id } });
}

// A bounded recovery pass for the authenticated worker. Oldest requests first; failures do not
// prevent another render from progressing. Provider start claims are never replayed.
export async function recoverRenders(take = 20): Promise<{ checked: number; failed: number }> {
  const rows = await db().render.findMany({
    where: { status: { in: ['drafting', 'rendering'] } },
    select: { id: true },
    orderBy: { updatedAt: 'asc' },
    take: Math.min(Math.max(take, 1), 50),
  });
  let failed = 0;
  for (const row of rows) {
    try {
      await advance(row.id);
    } catch (error) {
      failed++;
      reportError(error, { renderId: row.id, stage: 'render_recovery' });
    }
  }
  return { checked: rows.length, failed };
}

// The paid step: spends credits, then builds the 3D model from the photo and the sheet's views.
export async function startBuild(id: string, actor: Actor): Promise<Render> {
  if (!actor.userId) throw new AppError('Sign in to render in 3D', 401, 'sign_in');
  let render = await db().render.findUnique({ where: { id } });
  if (!render || !canAccess(render, actor)) throw notFound();
  if (render.status !== 'preview_ready') {
    if (render.status === 'rendering' || render.status === 'ready') return render;
    throw new AppError('This render cannot be built', 409, 'bad_state');
  }

  // An angle sheet bought earlier already counts toward the price, and so does the final sheet
  // of a product views set, which the build then reuses instead of drawing again.
  let alreadyPaid = render.credits;
  let owed = Math.max(0, buildTotal(render) - alreadyPaid);

  const claimed = await db().$transaction(async (tx) => {
    await lockRenderActor(tx, actor);
    // Check state after the lock: an identical concurrent request is an idempotent read.
    const current = await tx.render.findUnique({ where: { id } });
    if (current?.status !== 'preview_ready') return false;
    render = current;
    alreadyPaid = current.credits;
    owed = Math.max(0, buildTotal(current) - alreadyPaid);
    await assertGenerationConcurrency(actor, tx);
    if (actor.isUsingFreeModel) {
      const isGranted = await grantFirstModelInTransaction(tx, id, actor, owed);
      if (!isGranted)
        throw new AppError(
          'The free model is not available. Refresh to see your options.',
          409,
          'trial_unavailable',
        );
    }
    assertAuthorizedCredits(actor.isUsingFreeModel ? 0 : owed, actor);
    const { count } = await tx.render.updateMany({
      where: { id, status: 'preview_ready' },
      data: { status: 'rendering', userId: actor.userId, credits: alreadyPaid + owed },
    });
    if (!count) {
      if (actor.isUsingFreeModel)
        throw new AppError('This render has changed. Refresh and try again.', 409, 'bad_state');
      return false;
    }
    await spendCreditsInTransaction(tx, {
      userId: actor.userId as string,
      apiKeyId: actor.apiKeyId,
      amount: owed,
      key: `render:${id}`,
      reason: 'render',
      renderId: id,
    });
    await tx.renderEdit.create({ data: { renderId: id, kind: 'build', credits: owed } });
    render = await tx.render.findUniqueOrThrow({ where: { id } });
    return true;
  });
  if (!claimed) return (await db().render.findUnique({ where: { id } })) as Render;

  await captureRender(
    'render_start',
    { ...render, userId: actor.userId, credits: alreadyPaid + owed },
    { model_id: id, credits_spent: owed },
  );
  try {
    // A paid build draws the final sheet first (the visitor saw a cheaper draft); the 3D build
    // starts when it is done, in advance(). Without a draft the build runs from the photo alone.
    if (render.sheetKey && !render.hasFinalSheet) {
      const client = replicate();
      const source = await getFile(render.sourceKey);
      const sourceUrl = await client.upload(source, 'source.jpg', 'image/jpeg');
      const recipe = await harness();
      const notes = sheetNotes(render);
      const request = sheetRequest(
        sourceUrl,
        notes,
        selectSkillFrom(recipe.skills, render.name, notes),
        DEFAULT_FINAL_SHEET_SETTINGS,
        recipe.sheetPrompt,
        selectMaterialsFrom(recipe.materials, render.name, notes),
      );
      let prediction: Prediction | null = null;
      try {
        prediction = await client.start(
          request.path,
          request.body,
          config.webhookUrl(`/api/webhooks/replicate?render=${id}`),
        );
      } catch (error) {
        if (isUncertainStart(error)) throw error;
        // Only a definite rejection permits falling back to the draft.
        reportError(error, { renderId: id, stage: 'final_sheet_start' });
      }
      if (prediction) {
        return await persistStartedPrediction(render, { finalSheetPredictionId: prediction.id });
      }
    }
    const sheet = render.sheetKey ? await getFile(render.sheetKey) : null;
    const prediction = await startThreeD(id, render.sourceKey, sheet);
    return await persistStartedPrediction(render, {
      buildPredictionId: prediction.id,
      buildClaimedAt: new Date(),
    });
  } catch (error) {
    if (isUncertainStart(error)) {
      reportError(error, { renderId: id, stage: 'render_start_uncertain' });
      return (await db().render.findUnique({ where: { id } })) as Render;
    }
    await fail(id, error);
    throw new AppError(
      'Could not start the 3D render. Your credits were refunded.',
      502,
      'upstream',
    );
  }
}

// Starts the 3D build from the photo and, when there is one, the sheet's nine views.
async function startThreeD(id: string, sourceKey: string, sheet: Uint8Array | null) {
  const client = replicate();
  const source = await getFile(sourceKey);
  const images = [await client.upload(source, 'source.jpg', 'image/jpeg')];
  if (sheet) {
    const cells = await cutCells(sheet);
    for (let offset = 0; offset < cells.length; offset += 3) {
      images.push(
        ...(await Promise.all(
          cells
            .slice(offset, offset + 3)
            .map((cell, index) => client.upload(cell, `view-${offset + index}.png`, 'image/png')),
        )),
      );
    }
  }
  return client.start(
    '/predictions',
    buildRequest(images, (await harness()).build),
    config.webhookUrl(`/api/webhooks/replicate?render=${id}`),
  );
}

// The angle sheet on its own, for a render that has none yet. SHEET_ENABLED=false stops the free
// sheet at upload; this is the paid, on-demand way to get one, and its price counts toward the
// 3D render.
export async function startSheet(id: string, actor: Actor): Promise<Render> {
  if (!actor.userId) throw new AppError('Sign in to generate an angle sheet', 401, 'sign_in');
  const render = await db().render.findUnique({ where: { id } });
  if (!render || !canAccess(render, actor)) throw notFound();
  if (render.sheetKey || render.sheetPredictionId) return render;
  if (render.status !== 'preview_ready') {
    throw new AppError('This render cannot get an angle sheet', 409, 'bad_state');
  }

  const claimed = await db().$transaction(async (tx) => {
    await lockRenderActor(tx, actor);
    // Check state after the lock: an identical concurrent request is an idempotent read.
    const current = await tx.render.findUnique({ where: { id } });
    if (current?.status !== 'preview_ready') return null;
    await assertGenerationConcurrency(actor, tx);
    const { count } = await tx.render.updateMany({
      where: { id, status: 'preview_ready', sheetKey: null, sheetPredictionId: null },
      data: { status: 'drafting', userId: actor.userId, credits: SHEET_CREDITS },
    });
    if (!count) return null;
    assertAuthorizedCredits(SHEET_CREDITS, actor);
    await spendCreditsInTransaction(tx, {
      userId: actor.userId as string,
      apiKeyId: actor.apiKeyId,
      amount: SHEET_CREDITS,
      key: `sheet:${id}`,
      reason: 'angle_sheet',
      renderId: id,
    });
    await tx.renderEdit.create({ data: { renderId: id, kind: 'sheet', credits: SHEET_CREDITS } });
    return tx.render.findUniqueOrThrow({ where: { id } });
  });
  if (!claimed) return (await db().render.findUnique({ where: { id } })) as Render;

  await captureRender(
    'preview_start',
    { ...render, userId: actor.userId },
    {
      input_type: render.source === 'web' ? 'upload' : 'api',
      entry_path: render.landing_path,
      is_logged_in: true,
    },
  );
  try {
    return await startSheetPrediction(claimed);
  } catch (error) {
    if (isUncertainStart(error)) {
      reportError(error, { renderId: id, stage: 'render_start_uncertain' });
      return (await db().render.findUnique({ where: { id } })) as Render;
    }
    await fail(id, error, claimed);
    throw new AppError(
      'Could not start the angle sheet. Your credits were refunded.',
      502,
      'upstream',
    );
  }
}

// Draws the angle sheet from the stored photo and notes, and records the prediction.
async function startSheetPrediction(render: Render): Promise<Render> {
  const client = replicate();
  const bytes = await getFile(render.sourceKey);
  const contentType = render.sourceKey.endsWith('.png')
    ? 'image/png'
    : render.sourceKey.endsWith('.webp')
      ? 'image/webp'
      : 'image/jpeg';
  const sourceUrl = await client.upload(bytes, `source.${extension(contentType)}`, contentType);
  const recipe = await harness();
  const notes = sheetNotes(render);
  const request = sheetRequest(
    sourceUrl,
    notes,
    selectSkillFrom(recipe.skills, render.name, notes),
    recipe.sheet,
    recipe.sheetPrompt,
    selectMaterialsFrom(recipe.materials, render.name, notes),
  );
  const webhook = config.webhookUrl(`/api/webhooks/replicate?render=${render.id}`);
  let prediction: Prediction;
  try {
    prediction = await client.start(request.path, request.body, webhook);
  } catch (error) {
    // A server error Replicate actually returned means no prediction exists, so one retry on the
    // sturdier model is safe (as in createDraft). No response at all is ambiguous: never replay it.
    if (!(error instanceof ProviderRequestError) || (error.status ?? 0) < 500) throw error;
    reportError(error, {
      renderId: render.id,
      stage: 'sheet_start_fallback',
      ...failureContext(error),
    });
    const fallback = sheetRequest(
      sourceUrl,
      notes,
      selectSkillFrom(recipe.skills, render.name, notes),
      FALLBACK_SHEET_SETTINGS,
      recipe.sheetPrompt,
      selectMaterialsFrom(recipe.materials, render.name, notes),
    );
    prediction = await client.start(fallback.path, fallback.body, webhook);
  }
  return persistStartedPrediction(render, { sheetPredictionId: prediction.id });
}

// Redraws the angle sheet of a preview, steered by what the owner says is wrong with it. It costs
// one sheet (SHEET_CREDITS), separate from the 3D render's price, and is refunded if it fails; the
// sheet they already have is only replaced when the new one passes the guardrails. Every redraw
// starts from the photo, so the note has to describe everything to fix.
export async function redrawSheet(id: string, actor: Actor, note: string): Promise<Render> {
  if (!actor.userId) throw new AppError('Sign in to redraw the angle sheet', 401, 'sign_in');
  const fix = cleanNote(note);
  if (!fix) throw new AppError('Describe what to fix in the angle sheet', 400, 'empty_note');
  enforce(checkNote(fix), 400);
  const render = await db().render.findUnique({ where: { id } });
  if (!render || !canAccess(render, actor)) throw notFound();
  if (render.status !== 'preview_ready' || !render.sheetKey) {
    throw new AppError('This render has no angle sheet to redraw', 409, 'bad_state');
  }

  const claimed = await db().$transaction(async (tx) => {
    await lockRenderActor(tx, actor);
    // Check state after the lock: an identical concurrent request is an idempotent read.
    const current = await tx.render.findUnique({ where: { id } });
    if (current?.status !== 'preview_ready') return null;
    await assertGenerationConcurrency(actor, tx);
    const { count } = await tx.render.updateMany({
      where: {
        id,
        status: 'preview_ready',
        sheetKey: { not: null },
        sheetRedraws: render.sheetRedraws,
      },
      data: {
        status: 'drafting',
        userId: actor.userId,
        sheetRedraws: { increment: 1 },
        sheetNote: fix,
        sheetPredictionId: null,
        hasFinalSheet: false,
      },
    });
    if (!count) return null;
    assertAuthorizedCredits(SHEET_CREDITS, actor);
    await spendCreditsInTransaction(tx, {
      userId: actor.userId as string,
      apiKeyId: actor.apiKeyId,
      amount: SHEET_CREDITS,
      key: `redraw:${id}:${render.sheetRedraws + 1}`,
      reason: 'angle_sheet_redraw',
      renderId: id,
    });
    await tx.renderEdit.create({
      data: { renderId: id, kind: 'sheet_redraw', note: fix, credits: SHEET_CREDITS },
    });
    return tx.render.findUniqueOrThrow({ where: { id } });
  });
  if (!claimed) return (await db().render.findUnique({ where: { id } })) as Render;

  try {
    return await startSheetPrediction(claimed);
  } catch (error) {
    if (isUncertainStart(error)) {
      reportError(error, { renderId: id, stage: 'render_start_uncertain' });
      return (await db().render.findUnique({ where: { id } })) as Render;
    }
    await fail(id, error, claimed);
    throw new AppError(
      'Could not redraw the angle sheet. Your credits were refunded.',
      502,
      'upstream',
    );
  }
}

// What a full build costs this render: a sheet that is already the final one is not drawn again.
const buildTotal = (render: Pick<Render, 'hasFinalSheet'>) =>
  render.hasFinalSheet ? RENDER_CREDITS - FINAL_SHEET_CREDITS : RENDER_CREDITS;

export type RenderView = {
  id: string;
  status: Render['status'];
  prompt: string | null;
  name: string | null;
  error: string | null;
  hasPreview: boolean;
  // True once the 3x3 angle sheet exists. Without it the preview is the plain photo.
  hasSheet: boolean;
  // What the owner last asked to fix in the sheet, to prefill the next redraw.
  sheetNote: string | null;
  hasModel: boolean;
  // Changes when the render does, including its material edits: a viewer adds it to the model URL
  // so it never shows a cached copy of an older look.
  modelVersion: number;
  credits: number;
  renderCredits: number;
  sheetCredits: number;
  // What enlarging the angle sheet costs, and whether it can be done yet (the 3D model is paid).
  upscaleCredits: number;
  canUpscale: boolean;
  isPublic: boolean;
  source: RenderSource;
  createdAt: string;
};

export function toView(render: Render): RenderView {
  return {
    id: render.id,
    status: render.status,
    prompt: render.prompt,
    name: render.name,
    error: render.status === 'failed' ? 'Generation failed. Credits, if any, were refunded.' : null,
    hasPreview: render.status !== 'drafting' && render.status !== 'failed',
    hasSheet: Boolean(render.sheetKey),
    sheetNote: render.sheetNote,
    hasModel: render.status === 'ready' && Boolean(render.glbKey),
    modelVersion: render.updatedAt.getTime(),
    // A failed render was refunded in full, so nothing counts as spent on it.
    credits: render.status === 'failed' ? 0 : render.credits,
    renderCredits: buildTotal(render),
    sheetCredits: SHEET_CREDITS,
    upscaleCredits: UPSCALE_CREDITS,
    canUpscale: Boolean(render.sheetKey) && (render.status === 'ready' || render.hasFinalSheet),
    isPublic: render.isPublic,
    source: render.source as RenderSource,
    createdAt: render.createdAt.toISOString(),
  };
}

// Reads a render the actor may see (their own, or a public one), nudging its pipeline forward
// when it is still running.
// The render's history, newest first. Only the owner can read it.
export async function listEdits(id: string, actor: Actor): Promise<RenderEditView[]> {
  const render = await db().render.findUnique({ where: { id } });
  if (!render || !canAccess(render, actor)) throw notFound();
  if (!actor.userId || render.userId !== actor.userId) return [];
  const rows = await db().renderEdit.findMany({
    where: { renderId: id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return rows.map(toEditView).filter((edit): edit is RenderEditView => edit !== null);
}

export async function getRender(id: string, actor: Actor): Promise<Render> {
  const render = await db().render.findUnique({ where: { id } });
  if (!render || !canView(render, actor)) throw notFound();
  if (render.status === 'drafting' || render.status === 'rendering') {
    const now = new Date();
    const next = new Date(now.getTime() + POLL_INTERVAL_MS);
    const claimed = await db().$executeRaw`UPDATE "Render" SET "pollAfter" = ${next}
      WHERE "id" = ${id} AND ("pollAfter" IS NULL OR "pollAfter" <= ${now})`;
    if (!claimed) return render;
    return (await advance(id)) ?? render;
  }
  return render;
}

const IN_FLIGHT: Render['status'][] = ['drafting', 'rendering'];
const MAX_ADVANCE_PER_LIST = 8;

export type RenderPageInput = { cursor?: string; limit?: number; status?: Render['status'] };

export async function listRenderPage(userId: string, input: RenderPageInput = {}) {
  const limit = input.limit ?? 25;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new AppError('Limit must be an integer from 1 to 100', 400, 'bad_limit');
  }
  if (
    input.status &&
    !['drafting', 'preview_ready', 'rendering', 'ready', 'failed'].includes(input.status)
  ) {
    throw new AppError('Unknown render status', 400, 'bad_status');
  }
  let cursor: { id: string; createdAt: Date } | null = null;
  if (input.cursor) {
    try {
      if (input.cursor.length > 512) throw new Error('too long');
      const parsed = JSON.parse(Buffer.from(input.cursor, 'base64url').toString());
      const date = new Date(parsed.createdAt);
      if (
        typeof parsed.id !== 'string' ||
        !parsed.id ||
        parsed.id.length > 128 ||
        !Number.isFinite(date.getTime())
      ) {
        throw new Error('invalid');
      }
      cursor = { id: parsed.id, createdAt: date };
    } catch {
      throw new AppError('Invalid render cursor', 400, 'bad_cursor');
    }
  }
  const rows = await db().render.findMany({
    where: {
      userId,
      ...(input.status ? { status: input.status } : {}),
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });
  const renders = rows.slice(0, limit);
  const last = renders.at(-1);
  const nextCursor =
    rows.length > limit && last
      ? Buffer.from(
          JSON.stringify({
            id: last.id,
            createdAt: last.createdAt.toISOString(),
          }),
        ).toString('base64url')
      : null;
  return { renders, nextCursor };
}

// The user's whole catalog, newest first. Nudges a few in-flight items forward so the
// library makes progress even where Replicate cannot call the webhook (local dev).
export async function listLibrary(userId: string, take = 500): Promise<Render[]> {
  const renders = await db().render.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take,
  });
  const stale = renders
    .filter((render) => IN_FLIGHT.includes(render.status))
    .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
    .slice(0, MAX_ADVANCE_PER_LIST);
  if (stale.length === 0) return renders;
  const advanced = new Map(
    (await Promise.all(stale.map((render) => getRender(render.id, { userId }))))
      .filter((render) => render !== null)
      .map((render) => [render.id, render]),
  );
  return renders.map((render) => advanced.get(render.id) ?? render);
}

// Shows or hides a render in the public gallery. Only its owner can.
export async function setVisibility(id: string, actor: Actor, isPublic: boolean): Promise<Render> {
  const render = await db().render.findUnique({ where: { id } });
  if (!render || !canAccess(render, actor)) throw notFound();
  if (!actor.userId || render.userId !== actor.userId) {
    throw new AppError('Sign in to change who can see this render', 401, 'sign_in');
  }
  return db().render.update({ where: { id }, data: { isPublic } });
}

export function listPublicRenders(take = 12) {
  return db().render.findMany({
    where: { isPublic: true, status: 'ready', glbKey: { not: null } },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export function listRenders(userId: string, take = 24) {
  return db().render.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take });
}

export type DashboardStats = {
  total: number;
  ready: number;
  inFlight: number;
  byAgent: number;
};

// Counts for the dashboard overview. "By agent" covers both MCP and API-key renders.
export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const groups = await db().render.groupBy({
    by: ['status', 'source'],
    where: { userId },
    _count: { _all: true },
  });
  const stats: DashboardStats = { total: 0, ready: 0, inFlight: 0, byAgent: 0 };
  for (const group of groups) {
    const count = group._count._all;
    stats.total += count;
    if (group.status === 'ready') stats.ready += count;
    if (IN_FLIGHT.includes(group.status)) stats.inFlight += count;
    if (group.source !== 'web') stats.byAgent += count;
  }
  return stats;
}
