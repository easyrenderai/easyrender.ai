// The Replicate steps of the harness. The free preview draws a 1K angle sheet with Nano Banana 2.1
// and a paid build builds the 3D model from that same sheet: there is no second, bigger draw. A
// bake-off on the six showcase photos (2026-11-17, packages/harness/scripts/sheet-bakeoff.ts, see
// docs/benchmarks) found 1K sheets build as well as 2K ones, at half the sheet price. The 2K size
// is only used by product views, which cut the sheet into nine packshots.

export const A100_USD_PER_SECOND = 0.0014;

export const SHEET_MODEL = {
  name: 'Nano Banana 2.1',
  path: '/models/google/nano-banana-2.1/predictions',
  costUsd: 0.0336, // per 1K output image; keep in step with SHEET_COST_USD in pricing.ts
} as const;

// The 2K sheet that product views are cut from (nine packshots each need the pixels).
export const FINAL_SHEET_MODEL = {
  name: 'Nano Banana 2.1',
  path: '/models/google/nano-banana-2.1/predictions',
  costUsd: 0.0504, // per 2K output image; keep in step with FINAL_SHEET_COST_USD in pricing.ts
} as const;

// The upscaler: the paid Upscale action and the upscale step of every product view. Picked by a bake-off on interiors and product
// shots (.github/workflows/upscale-bakeoff.yml): it keeps the grain of wood, fabric and metal
// without inventing texture, takes a 2000 px picture where Real-ESRGAN (2 MP input limit) fails,
// answers in a few seconds and costs a fraction of the alternatives. It enlarges about 4x and
// caps the result at ENLARGE_MAX_SIDE; there is no scale setting.
export const ENLARGE_MODEL = {
  name: 'recraft-ai/recraft-crisp-upscale',
  path: '/models/recraft-ai/recraft-crisp-upscale/predictions',
  costUsd: 0.006, // per output image (Replicate lists about 166 images per $1); keep in step with ENLARGE_COST_USD in pricing.ts
} as const;

// The longest side an enlarged picture may have, and so the longest side one is made from: a
// picture over half of it would not even double.
export const ENLARGE_MAX_SIDE = 4096;

export function enlargeFactor(side: number): number | null {
  if (side < 1 || side > ENLARGE_MAX_SIDE / 2) return null;
  return Math.min(4, Math.floor(ENLARGE_MAX_SIDE / side));
}

export function enlargeRequest(imageUrl: string) {
  return { path: ENLARGE_MODEL.path, body: { input: { image: imageUrl } } };
}

export const BUILD_MODEL = {
  name: 'firtoz/trellis',
  version: 'e8f6c45206993f297372f5436b90350817bd9b4a0d52d2a76df50c1c8afa2b3c',
  usdPerSecond: A100_USD_PER_SECOND,
  input: {
    texture_size: 2048,
    mesh_simplify: 0.95,
    generate_model: true,
    generate_color: false,
    generate_normal: false,
    randomize_seed: false,
    seed: 42,
  },
} as const;

// The tunable part of each step. The private harness can override these; the cost and the model
// name stay in code so pricing never drifts from what is actually run.
export type SheetSettings = { path: string; input: Record<string, unknown> };
export type BuildSettings = { version: string; input: Record<string, unknown> };

export const DEFAULT_SHEET_SETTINGS: SheetSettings = {
  path: SHEET_MODEL.path,
  input: { aspect_ratio: '1:1', resolution: '1K', output_format: 'png' },
};

export const DEFAULT_FINAL_SHEET_SETTINGS: SheetSettings = {
  path: FINAL_SHEET_MODEL.path,
  input: { aspect_ratio: '1:1', resolution: '2K', output_format: 'png' },
};

// Used for the free preview only when Replicate answers the Nano Banana 2.1 request with a server
// error. Nano Banana 2 Lite is about the same price and passed the bake-off as often; it has no
// resolution setting and always draws 1K.
export const FALLBACK_SHEET_SETTINGS: SheetSettings = {
  path: '/models/google/nano-banana-2-lite/predictions',
  input: { aspect_ratio: '1:1', output_format: 'png' },
};

export const DEFAULT_BUILD_SETTINGS: BuildSettings = {
  version: BUILD_MODEL.version,
  input: { ...BUILD_MODEL.input },
};

export function buildRequest(images: string[], settings: BuildSettings = DEFAULT_BUILD_SETTINGS) {
  return { version: settings.version, input: { ...settings.input, images } };
}

export function buildCostUsd(predictSeconds: number | undefined): number {
  return (predictSeconds ?? 0) * BUILD_MODEL.usdPerSecond;
}
