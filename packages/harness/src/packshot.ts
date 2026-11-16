import sharp from 'sharp';
import { LIMITS, type Limits } from './guardrails';
import { type MaterialProfile, materialRules } from './materials';
import { DEFAULT_SHEET_SETTINGS } from './models';
import { cleanNote } from './note';
import { VIEWS } from './sheet';
import { DEFAULT_SKILL, type RenderSkill } from './skills';

// Product views: the nine sheet positions delivered as packshots. Each view is checked on its own
// (object in frame, white backdrop, sharp, same colours as the photo), drawn again when it fails,
// upscaled and set on a fixed white canvas. The checks measure pixels; they do not understand the
// product, so a view can pass and still be wrong, which is why the owner can polish any one.

export type ViewId = (typeof VIEWS)[number];
export const isViewId = (value: unknown): value is ViewId =>
  typeof value === 'string' && (VIEWS as readonly string[]).includes(value);

// The finished packshot: a square white canvas, long enough for a marketplace zoom.
export const PACKSHOT_SIDE = 2000;
// Space kept around the object on the canvas, as a share of the side.
const CANVAS_MARGIN = 0.06;

export const VIEW_PHRASES: Record<ViewId, string> = {
  front: 'straight-on front view',
  front_right: 'front-right three-quarter view',
  right: 'right side view',
  back_right: 'back-right three-quarter view',
  back: 'straight-on back view',
  back_left: 'back-left three-quarter view',
  left: 'left side view',
  front_left: 'front-left three-quarter view',
  top: 'top-down view',
};

export type ViewProblem =
  | 'empty'
  | 'cropped'
  | 'small'
  | 'background'
  | 'blurry'
  | 'colour'
  | 'duplicate';

// What each problem tells the model on the next try.
const PROBLEM_HINTS: Record<ViewProblem, string> = {
  empty: 'The object must be clearly visible and fill most of the frame.',
  cropped: 'Show the whole object with a margin on every side; nothing may touch the edge.',
  small: 'Draw the object larger in the frame, with fine detail.',
  background: 'The background must be plain pure white (#FFFFFF), with no tint, gradient or floor.',
  blurry: 'Draw crisp, sharp detail and clean edges.',
  colour: 'Match the exact colours and finish of the reference photo.',
  duplicate: 'This must be a different camera position from the other views.',
};

export function viewPrompt(input: {
  view: ViewId;
  // What the owner asked to fix, if this is a polish.
  note?: string | null;
  // What the checks found wrong with the last try, if this is an automatic retry.
  problems?: ViewProblem[];
  hasDraft: boolean;
  skill?: RenderSkill;
  materials?: MaterialProfile[];
  productNote?: string | null;
}): string {
  const parts = [
    input.hasDraft
      ? 'Image 1 is the real product photo. Image 2 is a draft of one view of it.'
      : 'Image 1 is the real product photo.',
    `Draw one studio packshot of this exact product as a ${VIEW_PHRASES[input.view]}.`,
    'Keep the same shape, proportions, materials, colour and every detail as the photo. Do not add, remove or redesign any part, and never invent logos, text or decoration.',
    'Show the full object centred with a small margin on every side. Plain pure white background (#FFFFFF), even soft studio light, no cast shadows, no floor, no text, no border.',
    `Product guidance: ${(input.skill ?? DEFAULT_SKILL).guidance}`,
  ];
  const rules = materialRules(input.materials ?? []);
  if (rules) parts.push(rules);
  const product = cleanNote(input.productNote);
  if (product) parts.push(`Additional notes about the object: ${product}`);
  const fix = cleanNote(input.note);
  if (fix) parts.push(`Fix this in the view: ${fix}`);
  for (const problem of input.problems ?? []) parts.push(PROBLEM_HINTS[problem]);
  return parts.join('\n');
}

// One view drawn on its own with the sheet model (1K, so it is sharper than a sheet cell).
export function viewRequest(
  sourceUrl: string,
  draftUrl: string | null,
  prompt: string,
  settings = DEFAULT_SHEET_SETTINGS,
) {
  return {
    path: settings.path,
    body: {
      input: {
        ...settings.input,
        prompt,
        image_input: draftUrl ? [sourceUrl, draftUrl] : [sourceUrl],
      },
    },
  };
}

// A view is enlarged only when its long side is short of the packshot canvas.
export const needsUpscale = (side: number): boolean => side < PACKSHOT_SIDE;

// The long side of a picture, in pixels.
export async function imageSide(image: Uint8Array): Promise<number> {
  const { width = 0, height = 0 } = await sharp(image).metadata();
  return Math.max(width, height);
}

// --- Measuring a picture -------------------------------------------------------------------

const MEASURE_SIDE = 160;
// How far (largest channel difference) a pixel must be from the backdrop to count as the object.
const OBJECT_DISTANCE = 28;

export type ObjectStats = {
  width: number;
  height: number;
  // Average colour of the object's pixels.
  meanRgb: [number, number, number];
  // Share of the picture the object covers, and its bounding box as shares of each side.
  coverage: number;
  box: { left: number; top: number; right: number; bottom: number } | null;
  // The backdrop: the median colour along the picture's edge, and how much of that edge is white.
  backdrop: [number, number, number];
  borderWhite: number;
  sharpness: number;
};

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

const round = (value: number, digits = 4) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

async function readSmall(image: Uint8Array) {
  const { data, info } = await sharp(image)
    .flatten({ background: '#ffffff' })
    .resize(MEASURE_SIDE, MEASURE_SIDE, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

// Finds the object as everything that differs from the backdrop, and measures it.
export async function measureObject(image: Uint8Array): Promise<ObjectStats> {
  const meta = await sharp(image).metadata();
  const { data, width, height } = await readSmall(image);
  const at = (x: number, y: number, c: number) => data[(y * width + x) * 3 + c] as number;

  const edge: [number, number, number][] = [];
  const ring = 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < ring || y < ring || x >= width - ring || y >= height - ring) {
        edge.push([at(x, y, 0), at(x, y, 1), at(x, y, 2)]);
      }
    }
  }
  const backdrop: [number, number, number] = [
    median(edge.map((p) => p[0])),
    median(edge.map((p) => p[1])),
    median(edge.map((p) => p[2])),
  ];
  const borderWhite = edge.filter((p) => Math.min(...p) >= 235).length / edge.length;

  let count = 0;
  let sum: [number, number, number] = [0, 0, 0];
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const distance = Math.max(
        Math.abs(at(x, y, 0) - backdrop[0]),
        Math.abs(at(x, y, 1) - backdrop[1]),
        Math.abs(at(x, y, 2) - backdrop[2]),
      );
      if (distance <= OBJECT_DISTANCE) continue;
      mask[y * width + x] = 1;
      count++;
      sum = [sum[0] + at(x, y, 0), sum[1] + at(x, y, 1), sum[2] + at(x, y, 2)];
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  // A lone speck of noise is not an object: the box needs at least a few pixels.
  const hasObject = count >= 12;

  // Variance of a 3x3 Laplacian over the object's pixels only, so a white backdrop does not
  // hide a soft object (and a sharp edge against the backdrop counts as detail).
  let lapSum = 0;
  let lapSq = 0;
  let lapCount = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (!mask[y * width + x]) continue;
      const grey = (px: number, py: number) => (at(px, py, 0) + at(px, py, 1) + at(px, py, 2)) / 3;
      const lap =
        4 * grey(x, y) - grey(x - 1, y) - grey(x + 1, y) - grey(x, y - 1) - grey(x, y + 1);
      lapSum += lap;
      lapSq += lap * lap;
      lapCount++;
    }
  }
  const lapMean = lapCount ? lapSum / lapCount : 0;

  return {
    width: meta.width ?? width,
    height: meta.height ?? height,
    meanRgb: hasObject
      ? [round(sum[0] / count, 1), round(sum[1] / count, 1), round(sum[2] / count, 1)]
      : [0, 0, 0],
    coverage: round(count / (width * height)),
    box: hasObject
      ? {
          left: round(left / width),
          top: round(top / height),
          right: round((right + 1) / width),
          bottom: round((bottom + 1) / height),
        }
      : null,
    backdrop,
    borderWhite: round(borderWhite),
    sharpness: round(lapCount ? lapSq / lapCount - lapMean * lapMean : 0, 2),
  };
}

export type ViewMeasures = {
  objectSide: number;
  coverage: number;
  borderWhite: number;
  backdrop: number;
  sharpness: number;
  colourDrift: number | null;
};

export type ViewCheck = { ok: boolean; problems: ViewProblem[]; measures: ViewMeasures };

// Distance between two colours, from 0 (same) to 1 (black against white).
const colourDistance = (a: [number, number, number], b: [number, number, number]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / Math.hypot(255, 255, 255);

// Checks one drawn view against the limits and, when there is one, the customer's photo.
export async function checkView(
  image: Uint8Array,
  source: ObjectStats | null,
  limits: Limits = LIMITS,
): Promise<ViewCheck> {
  const stats = await measureObject(image);
  const problems: ViewProblem[] = [];
  const box = stats.box;
  const objectSide = box
    ? Math.round(
        Math.max(box.right - box.left, box.bottom - box.top) * Math.max(stats.width, stats.height),
      )
    : 0;
  const backdrop = Math.min(...stats.backdrop);

  if (!box || stats.coverage < 0.01) problems.push('empty');
  else {
    const margin = limits.viewEdgeMargin;
    if (
      box.left < margin ||
      box.top < margin ||
      box.right > 1 - margin ||
      box.bottom > 1 - margin
    ) {
      problems.push('cropped');
    }
    if (objectSide < limits.viewMinObjectSide) problems.push('small');
    if (stats.sharpness < limits.viewMinSharpness) problems.push('blurry');
  }
  if (stats.borderWhite < limits.viewMinBorderWhite || backdrop < limits.viewMinBackground) {
    problems.push('background');
  }

  // Colour is only compared when both pictures have a clear object to measure.
  let colourDrift: number | null = null;
  if (box && source?.box && source.coverage >= 0.02) {
    colourDrift = round(colourDistance(stats.meanRgb, source.meanRgb));
    if (colourDrift > limits.viewMaxColourDrift) problems.push('colour');
  }

  return {
    ok: problems.length === 0,
    problems,
    measures: {
      objectSide,
      coverage: stats.coverage,
      borderWhite: stats.borderWhite,
      backdrop,
      sharpness: stats.sharpness,
      colourDrift,
    },
  };
}

// --- Finishing a view ----------------------------------------------------------------------

// Sets the object on the packshot canvas: a near-white backdrop is brought to pure white, the
// picture is trimmed to the object, and the object is centred with an even margin. The result is
// a JPEG, which is what shops and marketplaces take for a white-background packshot.
export async function finishView(image: Uint8Array, side = PACKSHOT_SIDE): Promise<Uint8Array> {
  const stats = await measureObject(image);
  const flat = sharp(image).flatten({ background: '#ffffff' });
  const { width = 0, height = 0 } = await sharp(image).metadata();

  let source = flat;
  // Only a near-white backdrop is lifted to white. Anything darker is a real backdrop problem
  // that the checks flag, and brightening it would also wash out the object.
  const [r, g, b] = stats.backdrop;
  if (Math.min(r, g, b) >= 200 && Math.min(r, g, b) < 255) {
    source = flat.linear(
      [255 / Math.max(r, 1), 255 / Math.max(g, 1), 255 / Math.max(b, 1)],
      [0, 0, 0],
    );
  }

  const box = stats.box;
  const inner = Math.round(side * (1 - CANVAS_MARGIN * 2));
  const crop = box
    ? {
        left: Math.max(0, Math.floor(box.left * width) - 2),
        top: Math.max(0, Math.floor(box.top * height) - 2),
        width: 0,
        height: 0,
      }
    : { left: 0, top: 0, width, height };
  if (box) {
    const right = Math.min(width, Math.ceil(box.right * width) + 2);
    const bottom = Math.min(height, Math.ceil(box.bottom * height) + 2);
    crop.width = Math.max(1, right - crop.left);
    crop.height = Math.max(1, bottom - crop.top);
  }

  const object = await source
    .extract(crop)
    .resize(inner, inner, { fit: 'inside', kernel: 'lanczos3' })
    .toBuffer();
  const info = await sharp(object).metadata();
  const buffer = await sharp({
    create: { width: side, height: side, channels: 3, background: '#ffffff' },
  })
    .composite([
      {
        input: object,
        left: Math.round((side - (info.width ?? inner)) / 2),
        top: Math.round((side - (info.height ?? inner)) / 2),
      },
    ])
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toBuffer();
  return new Uint8Array(buffer);
}

// The nine finished views laid back into a 3x3 sheet, in sheet order, for the 3D build.
export async function composeSheet(views: Uint8Array[], cell = 682): Promise<Uint8Array> {
  if (views.length !== VIEWS.length) throw new Error(`expected ${VIEWS.length} views`);
  const tiles = await Promise.all(
    views.map(async (view, index) => ({
      input: await sharp(view)
        .resize(cell, cell, { fit: 'contain', background: '#ffffff' })
        .toBuffer(),
      left: (index % 3) * cell,
      top: Math.floor(index / 3) * cell,
    })),
  );
  const buffer = await sharp({
    create: { width: cell * 3, height: cell * 3, channels: 3, background: '#ffffff' },
  })
    .composite(tiles)
    .png()
    .toBuffer();
  return new Uint8Array(buffer);
}

// Of two tries at the same view, the one with fewer problems (then the sharper one) is kept.
export function betterView(
  a: { problems: ViewProblem[]; sharpness: number },
  b: { problems: ViewProblem[]; sharpness: number },
): 'a' | 'b' {
  if (a.problems.length !== b.problems.length)
    return a.problems.length < b.problems.length ? 'a' : 'b';
  return a.sharpness >= b.sharpness ? 'a' : 'b';
}
