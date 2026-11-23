import { db, Prisma } from '@easyrender/db';
import { type RealSize, sanitizeRealSize } from '@easyrender/harness';
import { AppError, notFound } from './errors';
import { storedSize } from './render-materials';
import { type Actor, canAccess, getRender } from './renders';

// A render's real size as the AR page and the downloads use it. The stored GLB is never rewritten:
// the size is applied when the model is served, so removing it restores the generated file.
export type RenderSize = {
  size: RealSize | null;
  // Changes whenever the size does, so a viewer can bypass its cache of the model.
  version: number;
};

export async function getRenderSize(id: string, actor: Actor): Promise<RenderSize> {
  const render = await getRender(id, actor);
  return { size: storedSize(render), version: render.updatedAt.getTime() };
}

// Replaces the render's size. Only the owner can, and it costs no credits. `null` or an empty
// object removes it.
export async function saveRenderSize(
  id: string,
  actor: Actor,
  input: unknown,
): Promise<RenderSize> {
  const render = await db().render.findUnique({ where: { id } });
  if (!render || !canAccess(render, actor)) throw notFound();
  const size = sanitizeRealSize(input);
  if (size === undefined) {
    throw new AppError(
      'Send { "size": { "widthCm", "depthCm", "heightCm" } } with sides from 1 to 10000 cm, or null to remove it',
      400,
      'bad_body',
    );
  }
  const updated = await db().render.update({
    where: { id },
    data: { sizeCm: size ?? Prisma.DbNull },
  });
  return { size: storedSize(updated), version: updated.updatedAt.getTime() };
}
