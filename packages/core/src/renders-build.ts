import { db, Prisma, type Render } from '@easyrender/db';
import {
  BUILD_QUALITY_CREDITS,
  type BuildQuality,
  buildRequestFor,
  checkSheet,
  cutCells,
  RENDER_CREDITS,
} from '@easyrender/harness';
import { captureRender } from './analytics';
import { config } from './config';
import { grantCreditsInTransaction, spendCreditsInTransaction } from './credits';
import { AppError, notFound } from './errors';
import { grantFirstModelInTransaction } from './first-model-experiment';
import { withQuality } from './render-quality';
import { fail, TerminalRenderError } from './renders-fail';
import {
  type Actor,
  assertAuthorizedCredits,
  assertGenerationConcurrency,
  canAccess,
  harness,
  isUncertainStart,
  lockRenderActor,
  persistStartedPrediction,
  replicate,
} from './renders-shared';
import { reportError } from './report';
import { getFile } from './storage';

// The paid step: spends credits, then builds the 3D model. Low (the default) builds from the photo
// and the sheet's views; Medium and High build from the photo on a bigger model for more credits.
export async function startBuild(
  id: string,
  actor: Actor,
  quality: BuildQuality = 'low',
): Promise<Render> {
  if (!actor.userId) throw new AppError('Sign in to render in 3D', 401, 'sign_in');
  if (quality !== 'low' && actor.isUsingFreeModel) {
    throw new AppError('The free model is built at Low quality', 400, 'bad_quality');
  }
  const price = BUILD_QUALITY_CREDITS[quality];
  let render = await db().render.findUnique({ where: { id } });
  if (!render || !canAccess(render, actor)) throw notFound();
  if (render.status !== 'preview_ready') {
    if (render.status === 'rendering' || render.status === 'ready') return render;
    throw new AppError('This render cannot be built', 409, 'bad_state');
  }

  // An angle sheet bought earlier already counts toward the price, and so does the final sheet
  // of a product views set, which the build then reuses instead of drawing again.
  let alreadyPaid = render.credits;
  let owed = Math.max(0, price - alreadyPaid);

  const claimed = await db().$transaction(async (tx) => {
    await lockRenderActor(tx, actor);
    // Check state after the lock: an identical concurrent request is an idempotent read.
    const current = await tx.render.findUnique({ where: { id } });
    if (current?.status !== 'preview_ready') return false;
    render = current;
    alreadyPaid = current.credits;
    owed = Math.max(0, price - alreadyPaid);
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
      data: {
        status: 'rendering',
        userId: actor.userId,
        credits: alreadyPaid + owed,
        buildQuality: quality === 'low' ? null : quality,
        ...(actor.locale ? { notificationLocale: actor.locale } : {}),
      },
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
    // The 3D build runs on the sheet the visitor already saw (the stored one, never the watermarked
    // copy): there is no second draw. Without a sheet it runs from the photo alone.
    const prediction = await startThreeD(render, quality);
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

// Revalidate stored sheets before reusing them. A rejected sheet must never reach the 3D
// provider; both callers handle this as a terminal failure with an atomic credit refund.
async function checkedBuildSheet(key: string | null): Promise<Uint8Array | null> {
  if (!key) return null;
  const sheet = await getFile(key);
  const quality = await checkSheet(sheet, (await harness()).limits);
  if (!quality.ok) {
    throw new TerminalRenderError(`sheet rejected (${quality.code}): ${quality.message}`);
  }
  return sheet;
}

// Starts the 3D build at `quality`. Low builds from the photo and, when there is one, the checked
// sheet's nine views; Medium and High send the photo alone, so the sheet is not read.
async function startThreeD(
  render: Pick<Render, 'id' | 'sourceKey' | 'sheetKey'>,
  quality: BuildQuality,
) {
  const sheet = quality === 'low' ? await checkedBuildSheet(render.sheetKey) : null;
  const client = replicate();
  const source = await getFile(render.sourceKey);
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
    buildRequestFor(quality, images, (await harness()).build),
    config.webhookUrl(`/api/webhooks/replicate?render=${render.id}`),
  );
}

// Rebuilds a Medium or High model in Standard, free. The owner gets back the difference between
// what they paid and the standard price, once: the refund is a ledger row keyed by the render, in
// the same transaction that moves the render back to building, so two requests at once (a double
// click, an agent retry) refund a single time. The build runs on the sheet like any standard one.
export async function rebuildStandard(id: string, actor: Actor): Promise<Render> {
  if (!actor.userId) throw new AppError('Sign in to rebuild this model', 401, 'sign_in');
  const render = await db().render.findUnique({ where: { id } });
  if (!render || !canAccess(render, actor) || render.userId !== actor.userId) throw notFound();
  if (render.status !== 'ready' || !render.buildQuality) {
    // A rebuild already running, or one that finished, is the same request answered again.
    if (render.status === 'rendering' || (render.status === 'ready' && !render.buildQuality)) {
      return render;
    }
    throw new AppError('Only a Medium or High model can be rebuilt in Standard', 409, 'bad_state');
  }

  const claimed = await db().$transaction(async (tx) => {
    await lockRenderActor(tx, actor);
    // Check state after the lock: an identical concurrent request is an idempotent read.
    const current = await tx.render.findUnique({ where: { id } });
    if (current?.status !== 'ready' || !current.buildQuality) return null;
    await assertGenerationConcurrency(actor, tx);
    const refund = Math.max(0, current.credits - RENDER_CREDITS);
    const { count } = await tx.render.updateMany({
      where: { id, status: 'ready', buildQuality: current.buildQuality },
      data: {
        status: 'rendering',
        buildQuality: null,
        buildPredictionId: null,
        buildClaimedAt: null,
        // The new model has its own materials, so edits made to the old one no longer apply.
        materialEdits: Prisma.DbNull,
        credits: Math.min(current.credits, RENDER_CREDITS),
        quality: withQuality(current, {
          glb: undefined,
          fidelity: undefined,
          pollFailureReported: undefined,
        }),
      },
    });
    if (!count) return null;
    if (refund > 0) {
      await grantCreditsInTransaction(tx, {
        userId: actor.userId as string,
        amount: refund,
        key: `rebuild-refund:${id}`,
        reason: 'build_quality_refund',
        renderId: id,
      });
    }
    await tx.renderEdit.create({
      data: { renderId: id, kind: 'rebuild_standard', credits: refund },
    });
    return tx.render.findUniqueOrThrow({ where: { id } });
  });
  if (!claimed) return (await db().render.findUnique({ where: { id } })) as Render;

  try {
    const prediction = await startThreeD(claimed, 'low');
    return await persistStartedPrediction(claimed, {
      buildPredictionId: prediction.id,
      buildClaimedAt: new Date(),
    });
  } catch (error) {
    if (isUncertainStart(error)) {
      reportError(error, { renderId: id, stage: 'rebuild_start_uncertain' });
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
