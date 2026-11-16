import { db, type Render } from '@easyrender/db';
import {
  applyMaterialEdits,
  type GlbMaterial,
  type MaterialEdit,
  readGlbMaterials,
  sanitizeMaterialEdits,
} from '@easyrender/harness';
import { AppError, notFound } from './errors';
import { recordEdit } from './render-edits';
import { type Actor, canAccess, getRender } from './renders';
import { getFile } from './storage';

// A render's materials as the editor needs them: what the generated file has, and what the owner
// changed on top. The stored GLB is the original and is never rewritten; edits are applied when
// the model is served, so "reset" is just removing them.
export type RenderMaterials = {
  materials: GlbMaterial[];
  edits: MaterialEdit[];
  // Changes whenever the edits do, so a viewer can bypass its cache of the model.
  version: number;
};

// The edits stored on a render, or none when the stored value does not fit the file any more.
export function storedEdits(render: Pick<Render, 'materialEdits'>, materialCount: number) {
  return sanitizeMaterialEdits(render.materialEdits ?? [], materialCount) ?? [];
}

// The GLB a viewer or a download gets: the original with the owner's material edits applied.
export function servedModel(render: Pick<Render, 'materialEdits'>, original: Uint8Array) {
  const edits = storedEdits(render, readGlbMaterials(original).length);
  return applyMaterialEdits(original, edits);
}

async function readOriginal(render: Render): Promise<Uint8Array> {
  if (render.status !== 'ready' || !render.glbKey) {
    throw new AppError('Build the 3D model before editing its materials', 409, 'not_ready');
  }
  return getFile(render.glbKey);
}

function describe(render: Render, original: Uint8Array): RenderMaterials {
  const materials = readGlbMaterials(original);
  return {
    materials,
    edits: storedEdits(render, materials.length),
    version: render.updatedAt.getTime(),
  };
}

export async function getRenderMaterials(id: string, actor: Actor): Promise<RenderMaterials> {
  const render = await getRender(id, actor);
  return describe(render, await readOriginal(render));
}

// Replaces the render's material edits. Only the owner can, and it costs no credits: it is a
// change of factors, not a generation.
export async function saveMaterialEdits(
  id: string,
  actor: Actor,
  input: unknown,
): Promise<RenderMaterials> {
  const render = await db().render.findUnique({ where: { id } });
  if (!render || !canAccess(render, actor)) throw notFound();
  const original = await readOriginal(render);
  const count = readGlbMaterials(original).length;
  const edits = sanitizeMaterialEdits(input, count);
  if (!edits) {
    throw new AppError(
      'Send { "edits": [{ "index", "baseColor", "roughness", "metalness" }] }',
      400,
      'bad_body',
    );
  }
  const updated = await db().render.update({ where: { id }, data: { materialEdits: edits } });
  await recordEdit(id, 'material');
  return describe(updated, original);
}
