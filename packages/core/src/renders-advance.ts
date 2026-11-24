import { db, type Render } from '@easyrender/db';
import {
  BUILD_MODEL,
  BUILD_MODEL_2,
  buildCostUsd,
  checkGlb,
  checkSheet,
  download,
  findGlbUrl,
  isSettled,
  SHEET_MODEL,
  sheetOutputUrl,
} from '@easyrender/harness';
import { captureRender } from './analytics';
import { config } from './config';
import { finishMaterialFidelity } from './render-fidelity';
import { storedQuality, withQuality } from './render-quality';
import { storeViewModel } from './render-view-model';
import { fail, TerminalRenderError } from './renders-fail';
import { DAY_MS, harness, isUncertainStart, renderStage, replicate } from './renders-shared';
import { startSheetPrediction } from './renders-sheet';
import { reportError } from './report';
import { queueRenderServiceEmail } from './service-email';
import { putFile } from './storage';

// A sheet takes ~1 minute and a 3D build ~2: anything still running after this has been lost.
const STALE_MS = 45 * 60 * 1000;
// A start request lasts under a minute. A render with no prediction id after this long never
// reached Replicate, so it fails and refunds instead of leaving the visitor waiting.
const NEVER_STARTED_MS = 3 * 60 * 1000;
const RECOVERY_BATCH = 20;

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
        (render.status === 'rendering' && !render.buildPredictionId))
    ) {
      throw new TerminalRenderError(
        'never started',
        render.status === 'drafting' ? 'preview_never_started' : 'build_never_started',
      );
    }
    // The build was claimed but its 3D prediction never started (the worker died in between).
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
      if (
        !quality.ok &&
        ['sheet_repeated_views', 'sheet_inconsistent_structure'].includes(quality.code) &&
        !render.sheetKey &&
        !storedQuality(render).sheetRecoveryAttempts
      ) {
        // Claim before any provider call: polling/webhooks cannot both retry the same sheet.
        // A cleared prediction with no saved replacement is recovered by the normal timeout;
        // an ambiguous start must never cause another provider request.
        const { count } = await db().render.updateMany({
          where: renderStage(render),
          data: {
            sheetPredictionId: null,
            quality: withQuality(render, { sheetRecoveryAttempts: 1 }),
            costUsd: { increment: SHEET_MODEL.costUsd },
          },
        });
        if (!count) return db().render.findUnique({ where: { id } });
        const claimed = await db().render.findUniqueOrThrow({ where: { id } });
        try {
          return await startSheetPrediction(claimed);
        } catch (error) {
          if (isUncertainStart(error)) {
            reportError(error, { renderId: id, stage: 'sheet_recovery_start_uncertain' });
          } else {
            await fail(id, error, claimed);
          }
          return db().render.findUnique({ where: { id } });
        }
      }
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

    if (render.status === 'rendering' && render.buildPredictionId) {
      const prediction = await replicate().get(render.buildPredictionId);
      if (!isSettled(prediction.status)) {
        if (stale) throw new TerminalRenderError('3D render timed out');
        return render;
      }
      const url = prediction.status === 'succeeded' ? findGlbUrl(prediction.output) : null;
      if (!url)
        throw new TerminalRenderError(
          prediction.error ??
            `${render.buildQuality ? BUILD_MODEL_2.name : BUILD_MODEL.name} ${prediction.status}`,
        );
      const glb = await download(url);
      const quality = checkGlb(glb);
      if (!quality.ok)
        throw new TerminalRenderError(`model rejected (${quality.code}): ${quality.message}`);
      const finished = await finishMaterialFidelity(glb, render);
      const glbKey = await putFile('models/model.glb', finished.bytes, 'model/gltf-binary');
      // The copy viewers load. A failure here leaves it null and the first view makes it.
      const viewGlbKey = await storeViewModel(finished.bytes, glbKey);
      const completedAt = render.completedAt ?? new Date();
      const { count } = await db().$transaction(async (tx) => {
        const result = await tx.render.updateMany({
          where: renderStage(render),
          data: {
            status: 'ready',
            completedAt,
            glbKey,
            viewGlbKey,
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
    } else if (await claimPollFailureReport(id)) {
      reportError(error, { renderId: id, stage: 'render_poll_retryable' });
    }
  }
  return db().render.findUnique({ where: { id } });
}

// A retryable poll failure (provider read outage, a download that dropped) repeats on every poll
// and every cron pass until it clears, so only the first one per render goes to Sentry. The marker
// is written with raw SQL so `updatedAt`, which is the render's timeout deadline, does not move,
// and the conditional update lets exactly one concurrent caller win the report.
async function claimPollFailureReport(id: string): Promise<boolean> {
  const claimed = await db().$executeRaw`UPDATE "Render"
    SET "quality" = COALESCE("quality", '{}'::jsonb) || '{"pollFailureReported": true}'::jsonb
    WHERE "id" = ${id} AND COALESCE("quality"->>'pollFailureReported', 'false') <> 'true'`;
  return claimed > 0;
}

// A bounded recovery pass for the authenticated worker. Oldest requests first; failures do not
// prevent another render from progressing. Provider start claims are never replayed. The default
// is wide enough that a few slow jobs, which stay in flight until they go stale, cannot hide a
// newer render whose webhook was lost.
export async function recoverRenders(
  take = RECOVERY_BATCH,
): Promise<{ checked: number; failed: number }> {
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
