// The Replicate steps of the harness. The sheet + TRELLIS pair was picked by an A/B run on real
// listings (sheet drawn by Nano Banana Pro). The free preview now draws a 1K draft sheet with Nano
// Banana 2 Lite; a paid build redraws it at 2K with Nano Banana 2 and builds from that. Neither
// replacement has been A/B tested yet: see packages/harness/scripts/sheet-bakeoff.ts.

export const A100_USD_PER_SECOND = 0.0014;

export const SHEET_MODEL = {
  name: 'Nano Banana 2 Lite',
  path: '/models/google/nano-banana-2-lite/predictions',
  costUsd: 0.034, // per 1K output image; keep in step with SHEET_COST_USD in pricing.ts
} as const;

// The sheet a paid build is made from. The draft above is what the visitor sees for free.
export const FINAL_SHEET_MODEL = {
  name: 'Nano Banana 2',
  path: '/models/google/nano-banana-2/predictions',
  costUsd: 0.101, // per 2K output image; keep in step with FINAL_SHEET_COST_USD in pricing.ts
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
  // Lite has no resolution setting: it always draws 1K (about 1 megapixel).
  input: { aspect_ratio: '1:1', output_format: 'png' },
};

export const DEFAULT_FINAL_SHEET_SETTINGS: SheetSettings = {
  path: FINAL_SHEET_MODEL.path,
  input: { aspect_ratio: '1:1', resolution: '2K', output_format: 'png' },
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
