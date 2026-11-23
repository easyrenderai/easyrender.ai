import { db, type Render } from '@easyrender/db';
import { optimizeGlbForViewing } from '@easyrender/harness/glb-view';
import { reportError } from './report';
import { getFile, putFile } from './storage';

// The lighter copy of a finished model that viewers and AR load (see harness glb-view.ts). The
// stored GLB stays what is downloaded and what material edits start from.

/**
 * Stores the viewing copy of a model and returns its key: the original's key when the file could
 * not be made lighter, and null when storing failed (the copy is then made on first view).
 */
export async function storeViewModel(original: Uint8Array, glbKey: string): Promise<string | null> {
  try {
    const light = await optimizeGlbForViewing(original);
    if (!light) return glbKey;
    return await putFile('models/model-view.glb', light, 'model/gltf-binary');
  } catch (error) {
    reportError(error, { stage: 'view_model' });
    return null;
  }
}

// Renders made before the viewing copy existed are converted the first time one is viewed. Two
// viewers arriving together share one conversion.
const converting = new Map<string, Promise<string>>();

/** The key of the file a viewer should load for this render. Falls back to the original. */
export async function viewModelKey(
  render: Pick<Render, 'id' | 'glbKey' | 'viewGlbKey' | 'updatedAt'>,
): Promise<string> {
  const original = render.glbKey;
  if (!original) throw new Error('The render has no model');
  if (render.viewGlbKey) return render.viewGlbKey;
  const pending = converting.get(render.id);
  if (pending) return pending;
  const task = (async () => {
    const viewGlbKey = await storeViewModel(await getFile(original), original);
    if (!viewGlbKey) return original;
    // Only while the model is still the one that was converted, and without moving updatedAt:
    // it is the model's cache version in every viewer URL.
    await db().render.updateMany({
      where: { id: render.id, glbKey: original },
      data: { viewGlbKey, updatedAt: render.updatedAt },
    });
    return viewGlbKey;
  })()
    .catch((error) => {
      reportError(error, { renderId: render.id, stage: 'view_model' });
      return original;
    })
    .finally(() => converting.delete(render.id));
  converting.set(render.id, task);
  return task;
}
