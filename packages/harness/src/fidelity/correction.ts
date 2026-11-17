import sharp from 'sharp';
import { deltaE2000, linear, rgbToLab, srgb } from './color';
import {
  appendTexture,
  assertGeometryUnchanged,
  readDocument,
  textureBytes,
  writeDocument,
} from './glb-document';
import { normalizeObject, objectMask, overlap, type Pixels, photoPixels, png } from './images';
import {
  type FidelityCamera,
  type RenderScene,
  type RenderView,
  readRenderScene,
  renderView,
  type Vec,
} from './renderer';

export type CorrectionMeasure = {
  meanDeltaE: number;
  detailError: number;
  regions: number[];
  pixels: number;
};
export type CorrectionReport = {
  version: 1;
  status: 'accepted' | 'rejected' | 'skipped';
  reason: string;
  attempts: number;
  changedTexels: number;
  projectedTexels?: number;
  candidates?: { strength: number; measure: CorrectionMeasure; hasRegression: boolean }[];
  camera?: FidelityCamera & { silhouetteIoU: number };
  before?: CorrectionMeasure;
  after?: CorrectionMeasure;
  warnings: string[];
};
export type CorrectionResult = { bytes: Uint8Array; report: CorrectionReport };
const SIZE = 512,
  MIN_IOU = 0.85;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

// Shared pixels, rather than independent regional means, prevent missing parts from averaging
// against unrelated surfaces. Gradients expose blurred/misplaced detail even with equal hue.
export function measureCorrection(source: Pixels, image: Pixels): CorrectionMeasure {
  const sums = new Float64Array(9),
    counts = new Uint32Array(9);
  let total = 0,
    count = 0,
    detail = 0,
    edges = 0;
  const lab = (a: Pixels, p: number) => rgbToLab(a.data.subarray(p * 4, p * 4 + 3));
  for (let y = 1; y < source.height - 1; y++)
    for (let x = 1; x < source.width - 1; x++) {
      const p = y * source.width + x;
      if (!interior(source, image, x, y, 1)) continue;
      const error = deltaE2000(lab(source, p), lab(image, p));
      const region =
        Math.min(2, Math.floor((y * 3) / source.height)) * 3 +
        Math.min(2, Math.floor((x * 3) / source.width));
      sums[region] += error;
      counts[region]++;
      total += error;
      count++;
      for (const q of [p + 1, p + source.width])
        for (let c = 0; c < 3; c++) {
          detail += Math.abs(
            source.data[p * 4 + c] -
              source.data[q * 4 + c] -
              (image.data[p * 4 + c] - image.data[q * 4 + c]),
          );
          edges++;
        }
    }
  if (count < 64) throw new Error('insufficient_overlap');
  return {
    meanDeltaE: total / count,
    detailError: detail / Math.max(1, edges),
    regions: Array.from(sums, (v, i) => (counts[i] >= 32 ? v / counts[i] : 0)),
    pixels: count,
  };
}
function interior(a: Pixels, b: Pixels, x: number, y: number, radius: number) {
  if (x < radius || y < radius || x >= a.width - radius || y >= a.height - radius) return false;
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++) {
      const p = ((y + dy) * a.width + x + dx) * 4 + 3;
      if (a.data[p] < 250 || b.data[p] < 250) return false;
    }
  return true;
}
function findCamera(
  scene: RenderScene,
  source: Pixels,
  fineSource: Pixels,
  finalSource: Pixels,
  check: () => void,
) {
  let best: { camera: FidelityCamera; score: number; color: number } | undefined;
  const candidates: { camera: FidelityCamera; score: number }[] = [];
  const colorMask = new Uint8Array(finalSource.width * finalSource.height);
  for (let p = 0; p < colorMask.length; p++)
    colorMask[p] = finalSource.data[p * 4 + 3] > 127 ? 1 : 0;
  const colorSource = normalizeObject(finalSource, colorMask, 48);
  const colorTieBreak = (camera: FidelityCamera) => {
    // Pose tie-breaking needs only coarse appearance. Full-resolution CIEDE2000 belongs to
    // candidate acceptance, not every camera proposal (especially on CPU-limited workers).
    const image = renderView(scene, camera, 48).image;
    let sum = 0,
      count = 0;
    for (let p = 0; p < 48 * 48; p++) {
      if (image.data[p * 4 + 3] < 128 || colorSource.data[p * 4 + 3] < 128) continue;
      for (let c = 0; c < 3; c++)
        sum += Math.abs(image.data[p * 4 + c] - colorSource.data[p * 4 + c]);
      count++;
    }
    return count ? sum / (count * 3) : Infinity;
  };
  const chosen = () => {
    if (!best) throw new Error('camera_unavailable');
    return best;
  };
  const visited = new Set<string>();
  const visit = (camera: FidelityCamera) => {
    check();
    const key = `${source.width}:${camera.azimuth}:${camera.elevation}:${camera.distance ?? 'ortho'}`;
    if (visited.has(key)) return;
    visited.add(key);
    const silhouette = renderView(scene, camera, source.width, true).image;
    const score = overlap(source, silhouette);
    candidates.push({ camera, score });
    const color =
      score > 0.5 && (!best || score >= best.score - 1e-9) ? colorTieBreak(camera) : Infinity;
    if (
      !best ||
      score > best.score + 1e-9 ||
      (Math.abs(score - best.score) <= 1e-9 && color < best.color)
    )
      best = { camera, score, color };
  };
  for (let azimuth = 0; azimuth < 360; azimuth += 30)
    for (const elevation of [0, 15, 35]) visit({ azimuth, elevation });
  if (!best) throw new Error('camera_unavailable');
  const coarse = best.camera;
  for (const offset of [-10, 0, 10])
    for (const elevation of [
      Math.max(0, coarse.elevation - 10),
      coarse.elevation + 5,
      coarse.elevation + 15,
    ])
      for (const distance of [2, 4, undefined])
        visit({ azimuth: coarse.azimuth + offset, elevation, distance });
  const seeds = candidates.toSorted((a, b) => b.score - a.score).slice(0, 12);
  source = fineSource;
  best = undefined;
  for (const seed of seeds) visit(seed.camera);
  // Refine at a higher resolution so a one-pixel alias cannot select the wrong camera.
  for (let iteration = 0; iteration < 3; iteration++) {
    const current = chosen().camera;
    for (const offset of [-10, -5, 0, 5, 10])
      visit({ ...current, azimuth: current.azimuth + offset });
    const rotated = chosen().camera;
    for (const offset of [-5, -2.5, 0, 2.5, 5, 10])
      visit({ ...rotated, elevation: clamp(rotated.elevation + offset, 0, 70) });
    const elevated = chosen().camera;
    for (const distance of [2, 3, 4, 6, 8, undefined]) visit({ ...elevated, distance });
  }
  const refined = chosen().camera;
  source = finalSource;
  best = undefined;
  visit(refined);
  if (chosen().score >= 0.995) return chosen();
  // Resolve low-resolution silhouette aliases before any UV edits. Opposite table faces can
  // look identical at 96px but differ at the source comparison resolution.
  for (let azimuth = 0; azimuth < 360; azimuth += 30) visit({ ...refined, azimuth });
  const full = chosen().camera;
  for (const azimuth of [full.azimuth, (full.azimuth + 180) % 360])
    for (const offset of [-5, -2.5, 0, 2.5, 5])
      for (const distance of [2, 3, 4, 6, undefined])
        visit({ azimuth, elevation: clamp(full.elevation + offset, 0, 70), distance });
  return chosen();
}
type Atlas = {
  index: number;
  image: Pixels;
  target: Uint8Array;
  owners: Int32Array;
  changed: number;
};

// Exclude shared edges and repeated/overlapping UV islands, including hidden surfaces.
function visitTexels(
  vertices: number[][],
  width: number,
  height: number,
  visit: (p: number, w: number[]) => void,
  check: () => void,
) {
  const v = vertices.map(([u, v]) => [u * width, v * height]);
  if (vertices.some((uv) => uv.some((c) => !Number.isFinite(c) || c < 0 || c > 1))) return;
  const edge = (a: number[], b: number[], x: number, y: number) =>
    (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
  const area = edge(v[0], v[1], v[2][0], v[2][1]);
  if (Math.abs(area) < 1e-8) return;
  const x0 = Math.max(0, Math.floor(Math.min(...v.map((p) => p[0])))),
    x1 = Math.min(width - 1, Math.ceil(Math.max(...v.map((p) => p[0]))));
  const y0 = Math.max(0, Math.floor(Math.min(...v.map((p) => p[1])))),
    y1 = Math.min(height - 1, Math.ceil(Math.max(...v.map((p) => p[1]))));
  for (let y = y0; y <= y1; y++) {
    if (y % 32 === 0) check();
    for (let x = x0; x <= x1; x++) {
      const w = [
        edge(v[1], v[2], x + 0.5, y + 0.5) / area,
        edge(v[2], v[0], x + 0.5, y + 0.5) / area,
        edge(v[0], v[1], x + 0.5, y + 0.5) / area,
      ];
      if (w.every((a) => a > 1e-7)) visit(y * width + x, w);
    }
  }
}
async function projectPhoto(
  bytes: Uint8Array,
  scene: RenderScene,
  source: Pixels,
  view: RenderView,
  check: () => void,
) {
  const doc = readDocument(bytes),
    atlases = new Map<number, Atlas>();
  let totalPixels = 0;
  for (const [index, material] of (doc.json.materials ?? []).entries()) {
    check();
    const pbr = material.pbrMetallicRoughness,
      info = pbr?.baseColorTexture;
    const surface = scene.triangles.find((t) => t.surface.index === index)?.surface;
    if (
      !info ||
      !surface?.hasUv ||
      material.extensions ||
      info.extensions ||
      (material.alphaMode ?? 'OPAQUE') !== 'OPAQUE' ||
      (pbr?.baseColorFactor?.[3] ?? 1) < 1 ||
      (surface.metallic > 0.05 && !surface.mr) ||
      surface.roughness < 0.35
    )
      continue;
    if (
      surface.mr?.data.some(
        (v, i) =>
          (i % 4 === 2 && v * surface.metallic > 12) || (i % 4 === 1 && v * surface.roughness < 89),
      )
    )
      continue;
    if (
      scene.triangles.some(
        (t) =>
          t.surface.index === index &&
          t.vertices.some((v) => v.uv.some((c) => !Number.isFinite(c) || c < 0 || c > 1)),
      )
    )
      continue;
    const input = textureBytes(doc, info.index);
    const metadata = await sharp(input, { limitInputPixels: 4_194_304 }).metadata();
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > 4_194_304)
      continue;
    totalPixels += metadata.width * metadata.height;
    if (totalPixels > 8_388_608) throw new Error('correction_texture_budget');
    const { data, info: decoded } = await sharp(input, { limitInputPixels: 4_194_304 })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const image = { data: new Uint8Array(data), width: decoded.width, height: decoded.height };
    atlases.set(index, {
      index,
      image,
      target: new Uint8Array(data),
      owners: new Int32Array(image.width * image.height).fill(-1),
      changed: 0,
    });
  }
  for (const [id, triangle] of scene.triangles.entries()) {
    if (id % 1000 === 0) check();
    const atlas = atlases.get(triangle.surface.index);
    if (!atlas) continue;
    visitTexels(
      triangle.vertices.map((v) => v.uv),
      atlas.image.width,
      atlas.image.height,
      (p) => {
        atlas.owners[p] = atlas.owners[p] === -1 ? id : -2;
      },
      check,
    );
  }
  const normals = scene.triangles.map(({ vertices }) => {
    const a = vertices[1].position.map((v, i) => v - vertices[0].position[i]);
    const b = vertices[2].position.map((v, i) => v - vertices[0].position[i]);
    const n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const length = Math.hypot(...n) || 1;
    return n.map((v) => v / length) as Vec;
  });
  const confidence = surfaceConfidence(view.triangle, normals, source.width);
  for (const [id, triangle] of scene.triangles.entries()) {
    if (id % 1000 === 0) check();
    const atlas = atlases.get(triangle.surface.index);
    if (!atlas) continue;
    const verts = triangle.vertices;
    const a = verts[1].position.map((v, i) => v - verts[0].position[i]),
      b = verts[2].position.map((v, i) => v - verts[0].position[i]);
    const normal = [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
    const facing =
      Math.abs(normal.reduce((sum, v, i) => sum + v * view.eye[i], 0)) /
      (Math.hypot(...normal) || 1);
    if (facing < 0.7) continue;
    visitTexels(
      verts.map((v) => v.uv),
      atlas.image.width,
      atlas.image.height,
      (p, w) => {
        if (atlas.owners[p] !== id || atlas.image.data[p * 4 + 3] < 250) return;
        const position = [0, 1, 2].map((c) =>
          w.reduce((sum, v, i) => sum + v * verts[i].position[c], 0),
        ) as Vec;
        const [sx, sy, z] = view.project(position),
          x = Math.floor(sx),
          y = Math.floor(sy),
          q = y * source.width + x;
        if (!interior(source, view.image, x, y, 3) || confidence(x, y) === 0) return;
        // Permit neighbouring triangles only at the same visible depth and material. Using exact
        // IDs alone leaves a checkerboard of untouched texels on dense meshes.
        const visible = scene.triangles[view.triangle[q]];
        if (
          !visible ||
          visible.surface.index !== triangle.surface.index ||
          Math.abs(view.depth[q] - z) > view.pixelWorldSize * 0.75
        )
          return;
        let hasClipping = false;
        const values = [0, 1, 2].map((c) => {
          const value =
            (linear(source.data[q * 4 + c] / 255) - view.bias[q]) /
            (view.gain[q] * triangle.surface.factor[c]);
          if (!Number.isFinite(value) || value < 0.001 || value > 0.98) hasClipping = true;
          return Math.round(255 * srgb(clamp(value, 0, 1)));
        });
        if (hasClipping || values.some((v, c) => Math.abs(v - atlas.image.data[p * 4 + c]) > 80))
          return;
        const blend =
          (interior(source, view.image, x, y, 6) ? 1 : 0.5) *
          clamp((facing - 0.7) / 0.25, 0, 1) *
          confidence(x, y);
        for (let c = 0; c < 3; c++)
          atlas.target[p * 4 + c] = Math.round(
            atlas.image.data[p * 4 + c] * (1 - blend) + values[c] * blend,
          );
        atlas.changed++;
      },
      check,
    );
  }
  return { doc, atlases };
}

// At most two local candidates; no provider calls or credits. Only the visible source view is
// measurable. Photos contain lighting: this is a guarded appearance approximation, not inverse
// rendering or ground truth albedo recovery. Unobserved surfaces retain their original bytes.
// The render path runs with this budget. Callers that are not on the render path (tests on a slow
// runner, offline scripts) may pass a larger `budgetMs`.
const DEFAULT_BUDGET_MS = 15_000;

export async function correctFidelity(
  bytes: Uint8Array,
  photo: Uint8Array,
  options: { budgetMs?: number } = {},
): Promise<CorrectionResult> {
  const report: CorrectionReport = {
    version: 1,
    status: 'skipped',
    reason: 'no_safe_correction',
    attempts: 0,
    changedTexels: 0,
    warnings: ['single_view_fidelity_only', 'unseen_surfaces_preserved'],
  };
  const deadline = Date.now() + Math.max(0, options.budgetMs ?? DEFAULT_BUDGET_MS);
  const check = () => {
    if (Date.now() >= deadline) throw new Error('correction_budget_exceeded');
  };
  try {
    check();
    const image = await photoPixels(photo, 1024),
      mask = objectMask(image);
    const fraction = mask.reduce((sum, v) => sum + v, 0) / mask.length;
    if (fraction < 0.05 || fraction > 0.95) {
      report.reason = 'uncertain_photo_mask';
      return { bytes, report };
    }
    const source = normalizeObject(image, mask, SIZE),
      scene = await readRenderScene(bytes, 512);
    if (scene.warnings.length) {
      report.reason = 'unsupported_scene';
      return { bytes, report };
    }
    const match = findCamera(
      scene,
      normalizeObject(image, mask, 96),
      normalizeObject(image, mask, 192),
      source,
      check,
    );
    const view = renderView(scene, match.camera, SIZE),
      score = overlap(source, view.image);
    report.camera = { ...match.camera, silhouetteIoU: score };
    if (score < MIN_IOU) {
      report.reason = 'camera_or_geometry_mismatch';
      return { bytes, report };
    }
    const before = measureCorrection(source, view.image);
    report.before = before;
    const { doc, atlases } = await projectPhoto(bytes, scene, source, view, check);
    report.projectedTexels = [...atlases.values()].reduce((sum, atlas) => sum + atlas.changed, 0);
    if (report.projectedTexels < 64) {
      report.reason = 'insufficient_safe_texels';
      return { bytes, report };
    }
    let best = bytes,
      bestMeasure = before;
    for (const strength of [0.6, 1]) {
      check();
      report.attempts++;
      const candidate = readDocument(bytes);
      for (const atlas of atlases.values()) {
        if (!atlas.changed) continue;
        const data = atlas.image.data.map((v, i) =>
          i % 4 === 3 ? v : Math.round(v + strength * (atlas.target[i] - v)),
        );
        const pbr = candidate.json.materials?.[atlas.index].pbrMetallicRoughness;
        if (!pbr?.baseColorTexture) continue;
        const sampler = doc.json.textures?.[pbr.baseColorTexture.index].sampler;
        pbr.baseColorTexture = {
          ...pbr.baseColorTexture,
          index: appendTexture(candidate, await png({ ...atlas.image, data }), sampler),
        };
      }
      const output = writeDocument(candidate);
      assertGeometryUnchanged(bytes, output);
      const measured = measureCorrection(
        source,
        renderView(await readRenderScene(output, 512), match.camera, SIZE).image,
      );
      check();
      const hasImprovement =
        measured.meanDeltaE < before.meanDeltaE * 0.95 &&
        before.meanDeltaE - measured.meanDeltaE > 0.3;
      const hasRegression =
        measured.detailError > before.detailError + 0.02 ||
        measured.regions.some((v, i) => v > before.regions[i] + 1);
      report.candidates ??= [];
      report.candidates.push({ strength, measure: measured, hasRegression });
      if (hasImprovement && !hasRegression && measured.meanDeltaE < bestMeasure.meanDeltaE) {
        best = output;
        bestMeasure = measured;
      }
    }
    report.after = bestMeasure;
    report.status = best === bytes ? 'rejected' : 'accepted';
    report.changedTexels = best === bytes ? 0 : report.projectedTexels;
    report.reason = best === bytes ? 'no_verified_improvement' : 'visible_appearance_improved';
    return { bytes: best, report };
  } catch (error) {
    const known = [
      'correction_budget_exceeded',
      'correction_texture_budget',
      'insufficient_overlap',
    ];
    report.reason =
      error instanceof Error && known.includes(error.message)
        ? error.message
        : 'correction_unavailable';
    return { bytes, report };
  }
}

// Feather away from internal creases, not just silhouettes. Otherwise slight registration
// error can bake tabletop pixels into the front edge as a noisy stripe.
export function surfaceConfidence(ids: Int32Array, normals: Vec[], size: number) {
  const cache = new Float32Array(ids.length).fill(-1);
  return (x: number, y: number): number => {
    const p = y * size + x;
    if (cache[p] >= 0) return cache[p];
    const normal = normals[ids[p]];
    if (!normal) return 0;
    for (let radius = 1; radius <= 8; radius++) {
      for (const [dx, dy] of [
        [radius, 0],
        [-radius, 0],
        [0, radius],
        [0, -radius],
        [radius, radius],
        [-radius, radius],
        [radius, -radius],
        [-radius, -radius],
      ]) {
        const nx = x + dx,
          ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const neighbor = normals[ids[ny * size + nx]];
        if (!neighbor || normal.reduce((sum, v, i) => sum + v * neighbor[i], 0) < 0.95) {
          cache[p] = clamp((radius - 2) / 6, 0, 1);
          return cache[p];
        }
      }
    }
    cache[p] = 1;
    return 1;
  };
}
