import sharp from 'sharp';
import { cleanNote } from './note';
import { cutCells, VIEWS } from './sheet';

// Checks that run before and after the paid model calls. Inputs are rejected early, so a bad
// photo never costs a generation; outputs are checked before they are stored, so a broken sheet
// or model is refunded instead of delivered.

// What a check measured, kept per render so quality can be compared across renders and models.
export type PhotoMeasures = { width: number; height: number; spread: number; sharpness: number };
export type SheetMeasures = {
  side: number;
  emptyCells: number;
  // Eight turnaround views are compared; `repeatedViews` counts those with a near twin and
  // `closestViews` is the smallest difference between any two (0 identical, 0.03+ distinct).
  repeatedViews: number;
  closestViews: number;
};
export type GlbMeasures = { bytes: number };

export type Rejected = { ok: false; code: string; message: string };
export type Passed<M> = { ok: true; warnings: string[]; measures: M };
export type Check<M = Record<string, never>> = Passed<M> | Rejected;

const ok = <M>(measures: M, warnings: string[] = []): Passed<M> => ({
  ok: true,
  warnings,
  measures,
});
const reject = (code: string, message: string): Rejected => ({ ok: false, code, message });

export const LIMITS = {
  minPhotoSide: 400,
  goodPhotoSide: 800,
  maxPhotoSide: 12_000,
  maxAspect: 4,
  minPhotoSpread: 6, // standard deviation of brightness; below this the photo is a flat colour
  minSheetSide: 768,
  maxEmptyCells: 2,
  minGlbBytes: 20_000,
  // Two views count as the same picture when their 64px greyscale copies differ by less than
  // this fraction. Measured: distinct turnaround views differ by 0.03+, a sheet that repeats one
  // view differs by under 0.01.
  duplicateViewDistance: 0.015,
  maxDuplicateViews: 3,
  // Product views: each view is checked on its own before it is kept. A view that fails is drawn
  // again on its own (up to `viewMaxRetries` times) and, if it still fails, kept and flagged.
  viewMinObjectSide: 240, // longest side of the object, in pixels of the drawn view
  viewMinBorderWhite: 0.9, // share of the view's edge that is white
  viewMinBackground: 225, // the edge's median brightness; lower is a grey or tinted backdrop
  viewEdgeMargin: 0.01, // the object may not come closer to the edge than this share of the side
  viewMaxColourDrift: 0.22, // colour distance to the photo (0 same, 1 opposite), object pixels only
  viewMinSharpness: 20, // Laplacian variance over the object: real views measure 370+, a visibly soft one under 10
  viewMaxRetries: 1,
};

export type Limits = typeof LIMITS;

// Notes that try to rewrite the instructions are rejected rather than passed to the model.
const OVERRIDE =
  /\b(ignore|disregard|forget|override)\b.{0,40}\b(instruction|prompt|rule|above|previous)/i;
const ROLE_PLAY = /\b(system prompt|you are now|act as|developer mode)\b/i;

export function checkNote(note: string | null | undefined): Check {
  const text = cleanNote(note);
  if (OVERRIDE.test(text) || ROLE_PLAY.test(text)) {
    return reject('bad_prompt', 'Describe the product only, for example its material or colour.');
  }
  return ok({});
}

const round = (value: number) => Math.round(value * 10_000) / 10_000;

type Stats = { mean: number; stdev: number };

async function brightness(image: Uint8Array | Buffer, size: number): Promise<Stats> {
  const { channels } = await sharp(image).greyscale().resize(size, size, { fit: 'inside' }).stats();
  return { mean: channels[0]?.mean ?? 0, stdev: channels[0]?.stdev ?? 0 };
}

// Variance of a 3x3 Laplacian over a small greyscale copy: low means the photo is out of focus.
async function sharpness(image: Uint8Array): Promise<number> {
  const { data, info } = await sharp(image)
    .greyscale()
    .resize(256, 256, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap =
        4 * (data[i] as number) -
        (data[i - 1] as number) -
        (data[i + 1] as number) -
        (data[i - width] as number) -
        (data[i + width] as number);
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

export async function checkPhoto(bytes: Uint8Array): Promise<Check<PhotoMeasures>> {
  let width: number;
  let height: number;
  try {
    const meta = await sharp(bytes).metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
  } catch {
    return reject('bad_image', 'That file could not be read as a photo.');
  }
  if (!width || !height) return reject('bad_image', 'That file could not be read as a photo.');
  const shortest = Math.min(width, height);
  const longest = Math.max(width, height);
  if (shortest < LIMITS.minPhotoSide) {
    return reject(
      'photo_too_small',
      `The photo is too small. Use one at least ${LIMITS.minPhotoSide}px on each side.`,
    );
  }
  if (longest > LIMITS.maxPhotoSide) {
    return reject('photo_too_large', 'The photo dimensions are too large. Use one under 12,000px.');
  }
  if (longest / shortest > LIMITS.maxAspect) {
    return reject('photo_aspect', 'The photo is too narrow. Use one that shows the whole product.');
  }
  const { stdev } = await brightness(bytes, 256);
  if (stdev < LIMITS.minPhotoSpread) {
    return reject('photo_blank', 'The photo looks empty. Upload a clear photo of the product.');
  }
  const warnings: string[] = [];
  const focus = await sharpness(bytes);
  if (shortest < LIMITS.goodPhotoSide) warnings.push('low_resolution');
  if (focus < 8) warnings.push('blurry');
  return ok({ width, height, spread: round(stdev), sharpness: round(focus) }, warnings);
}

// The sheet must be a usable 3x3 grid: big enough, with an object in nearly every cell.
export async function checkSheet(
  sheet: Uint8Array,
  limits: Limits = LIMITS,
): Promise<Check<SheetMeasures>> {
  let side: number;
  try {
    const { width = 0, height = 0 } = await sharp(sheet).metadata();
    side = Math.min(width, height);
  } catch {
    return reject('sheet_unreadable', 'The angle sheet could not be read.');
  }
  if (side < limits.minSheetSide)
    return reject('sheet_small', 'The angle sheet came back too small.');

  const cells = await cutCells(sheet);
  let empty = 0;
  const signatures: Uint8Array[] = [];
  for (const cell of cells) {
    const { data, info } = await sharp(cell)
      .resize(64, 64, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    // Background is the white of the cell border; anything clearly off-white is object.
    let object = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      const min = Math.min(data[i] as number, data[i + 1] as number, data[i + 2] as number);
      if (min < 235) object++;
    }
    if (object / (info.width * info.height) < 0.005) empty++;
    signatures.push(
      new Uint8Array(
        await sharp(cell).greyscale().resize(64, 64, { fit: 'fill' }).raw().toBuffer(),
      ),
    );
  }
  if (empty > limits.maxEmptyCells) {
    return reject('sheet_empty', `The angle sheet is missing the object in ${empty} of 9 views.`);
  }

  // The eight turnaround views must be different pictures: a model that repeats one view (or
  // pastes the photo into every cell) gives TRELLIS nothing to reconstruct from.
  const ring = signatures.slice(0, VIEWS.length - 1);
  const distance = (a: Uint8Array, b: Uint8Array) =>
    a.reduce((sum, value, i) => sum + Math.abs(value - (b[i] as number)), 0) / a.length / 255;
  const nearest = ring.map((view, i) =>
    Math.min(
      ...ring.map((other, j) => (i === j ? Number.POSITIVE_INFINITY : distance(view, other))),
    ),
  );
  const repeated = nearest.filter((gap) => gap < limits.duplicateViewDistance).length;
  if (repeated > limits.maxDuplicateViews) {
    return reject(
      'sheet_repeated_views',
      `The angle sheet repeats the same view in ${repeated} of 8 cells.`,
    );
  }
  return ok(
    { side, emptyCells: empty, repeatedViews: repeated, closestViews: round(Math.min(...nearest)) },
    [...(empty > 0 ? ['empty_cell'] : []), ...(repeated > 0 ? ['similar_views'] : [])],
  );
}

// A binary glTF: magic, version 2, and a declared length that matches the file.
export function checkGlb(bytes: Uint8Array): Check<GlbMeasures> {
  if (bytes.byteLength < LIMITS.minGlbBytes)
    return reject('glb_small', 'The 3D model came back empty.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67)
    return reject('glb_magic', 'The 3D model file is not valid.');
  if (view.getUint32(4, true) !== 2)
    return reject('glb_version', 'The 3D model file is not valid.');
  if (view.getUint32(8, true) !== bytes.byteLength) {
    return reject('glb_truncated', 'The 3D model download was cut short.');
  }
  return ok({ bytes: bytes.byteLength });
}
