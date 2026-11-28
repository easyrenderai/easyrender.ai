import { db } from '@easyrender/db';
import { AppError, notFound } from './errors';
import { parseModelFeedback } from './model-feedback-input';
import type { Actor } from './renders';

async function ownedModel(id: string, actor: Actor) {
  if (!actor.userId) throw new AppError('Sign in first', 401, 'unauthorized');
  const render = await db().render.findFirst({
    where: { id, userId: actor.userId },
    select: { status: true, glbKey: true },
  });
  if (!render) throw notFound();
  return render;
}

// The page needs only this flag. Comments never enter the public render view or analytics.
export async function hasModelFeedback(id: string, actor: Actor): Promise<boolean> {
  await ownedModel(id, actor);
  return (await db().modelFeedback.count({ where: { renderId: id } })) > 0;
}

export async function saveModelFeedback(id: string, actor: Actor, input: unknown) {
  const render = await ownedModel(id, actor);
  const feedback = parseModelFeedback(input);
  if (render.status !== 'ready' || !render.glbKey) {
    throw new AppError('Model is not ready', 409, 'model_not_ready');
  }
  // Parameters keep free text out of Prisma's model-operation diagnostics. Recheck eligibility
  // in the insert itself; the primary key chooses one winner even across dismiss/respond races.
  const saved = await db().$executeRaw`
    INSERT INTO "ModelFeedback" ("renderId", "rating", "reasons", "comment")
    SELECT "id", ${feedback.rating}::integer, ${feedback.reasons}::text[], ${feedback.comment}
    FROM "Render" WHERE "id" = ${id} AND "userId" = ${actor.userId}
      AND "status" = 'ready' AND "glbKey" IS NOT NULL
    ON CONFLICT ("renderId") DO NOTHING
  `.catch(() => {
    throw new AppError('Could not save model feedback', 500, 'feedback_unavailable');
  });
  if (saved === 0) {
    if (await hasModelFeedback(id, actor))
      throw new AppError('Feedback already recorded', 409, 'feedback_exists');
    throw new AppError('Model is not ready', 409, 'model_not_ready');
  }
  return { recorded: true };
}
