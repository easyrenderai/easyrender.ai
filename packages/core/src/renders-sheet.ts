import { db, type Render } from '@easyrender/db';
import {
  checkNote,
  cleanNote,
  FALLBACK_SHEET_SETTINGS,
  type Prediction,
  ProviderRequestError,
  SHEET_CREDITS,
  selectMaterialsFrom,
  selectSkillFrom,
  sheetRequest,
} from '@easyrender/harness';
import { captureRender } from './analytics';
import { config } from './config';
import { spendCreditsInTransaction } from './credits';
import { AppError, notFound } from './errors';
import { withQuality } from './render-quality';
import { fail } from './renders-fail';
import {
  type Actor,
  assertAuthorizedCredits,
  assertGenerationConcurrency,
  canAccess,
  enforce,
  extension,
  failureContext,
  harness,
  isUncertainStart,
  lockRenderActor,
  persistStartedPrediction,
  replicate,
} from './renders-shared';
import { reportError } from './report';
import { getFile } from './storage';

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

// What the sheet prompt is told about the object: the owner's fix note first (so the length cap
// never cuts it), then their original prompt.
const sheetNotes = (render: Pick<Render, 'prompt' | 'sheetNote'>) =>
  cleanNote([render.sheetNote, render.prompt].filter(Boolean).join('. ')) || null;

// Draws the angle sheet and records the prediction. It is the one place a sheet is started: the
// free preview (which already holds the upload), the paid sheet, a redraw and the repeat after a
// rejected sheet. Without `options.source` the photo is read back from storage.
export async function startSheetPrediction(
  render: Render,
  options: {
    source?: { bytes: Uint8Array; contentType: string };
    // Which fallback a report names: the free preview and a paid sheet are told apart in Sentry.
    fallbackStage?: string;
  } = {},
): Promise<Render> {
  const { source } = options;
  const client = replicate();
  const bytes = source?.bytes ?? (await getFile(render.sourceKey));
  const contentType =
    source?.contentType ??
    (render.sourceKey.endsWith('.png')
      ? 'image/png'
      : render.sourceKey.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg');
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
    // sturdier model is safe. No response at all is ambiguous: never replay it.
    if (!(error instanceof ProviderRequestError) || (error.status ?? 0) < 500) throw error;
    reportError(error, {
      renderId: render.id,
      stage: options.fallbackStage ?? 'sheet_start_fallback',
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
        quality: withQuality(current, { refundedCorrectionCredits: 0 }),
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
