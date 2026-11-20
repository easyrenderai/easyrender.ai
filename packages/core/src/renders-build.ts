import { db, type Render } from '@easyrender/db';
import { buildRequest, checkSheet, cutCells, RENDER_CREDITS } from '@easyrender/harness';
import { captureRender } from './analytics';
import { config } from './config';
import { spendCreditsInTransaction } from './credits';
import { AppError, notFound } from './errors';
import { grantFirstModelInTransaction } from './first-model-experiment';
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
  let owed = Math.max(0, RENDER_CREDITS - alreadyPaid);

  const claimed = await db().$transaction(async (tx) => {
    await lockRenderActor(tx, actor);
    // Check state after the lock: an identical concurrent request is an idempotent read.
    const current = await tx.render.findUnique({ where: { id } });
    if (current?.status !== 'preview_ready') return false;
    render = current;
    alreadyPaid = current.credits;
    owed = Math.max(0, RENDER_CREDITS - alreadyPaid);
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
    const sheet = await checkedBuildSheet(render.sheetKey);
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

// Starts the 3D build from the photo and, when there is one, the checked sheet's nine views.
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
