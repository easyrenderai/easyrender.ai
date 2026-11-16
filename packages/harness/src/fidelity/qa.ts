import sharp from 'sharp';
import { deltaE2000, type Lab, rgbToLab } from './color';
import { detectMaterial, isMetalColor } from './detection';
import { geometryHash } from './glb-document';
import { objectMask, type Pixels, photoPixels, png } from './images';
import { inspectMaterials, type MaterialMeasure } from './materials';
import { readRenderScene, renderNeutral } from './renderer';

import { FIDELITY_THRESHOLDS } from './thresholds';

export { FIDELITY_THRESHOLDS } from './thresholds';
export type FidelityReport = {
  version: 1;
  isFlagged: boolean;
  status: 'measured' | 'unavailable';
  warnings: string[];
  thresholds: typeof FIDELITY_THRESHOLDS;
  geometryHash?: string;
  camera?: {
    azimuth: number;
    elevation: number;
    method: 'supplied' | 'silhouette-search';
    silhouetteIoU: number;
  };
  color?: {
    meanDeltaE: number;
    maxDeltaE: number;
    regions: { row: number; column: number; deltaE: number; pixels: number }[];
  };
  photoMetalFraction?: number;
  materials?: MaterialMeasure[];
};
export type FidelityArtifacts = { report: FidelityReport; comparison?: Uint8Array; html: string };

export function unavailableReport(reason: string): FidelityReport {
  return {
    version: 1,
    isFlagged: true,
    status: 'unavailable',
    warnings: [reason],
    thresholds: FIDELITY_THRESHOLDS,
  };
}

function normalizeObject(image: Pixels, mask: Uint8Array, size = 192): Pixels {
  let left = image.width,
    right = 0,
    top = image.height,
    bottom = 0;
  for (let p = 0; p < mask.length; p++)
    if (mask[p]) {
      left = Math.min(left, p % image.width);
      right = Math.max(right, p % image.width);
      top = Math.min(top, Math.floor(p / image.width));
      bottom = Math.max(bottom, Math.floor(p / image.width));
    }
  if (left > right || top > bottom) throw new Error('No object mask');
  const scale = (size - 12) / Math.max(right - left + 1, bottom - top + 1);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const sx = Math.round((x - size / 2) / scale + (left + right) / 2);
      const sy = Math.round((y - size / 2) / scale + (top + bottom) / 2);
      if (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height) continue;
      const p = sy * image.width + sx;
      if (mask[p]) data.set(image.data.subarray(p * 4, p * 4 + 4), (y * size + x) * 4);
    }
  return { data, width: size, height: size };
}

function overlap(a: Pixels, b: Pixels) {
  let intersection = 0,
    union = 0;
  for (let i = 3; i < a.data.length; i += 4) {
    const hasA = a.data[i] > 127,
      hasB = b.data[i] > 127;
    if (hasA && hasB) intersection++;
    if (hasA || hasB) union++;
  }
  return intersection / Math.max(1, union);
}

export function compareRegions(a: Pixels, b: Pixels): NonNullable<FidelityReport['color']> {
  const regions: NonNullable<FidelityReport['color']>['regions'] = [];
  for (let row = 0; row < 3; row++)
    for (let column = 0; column < 3; column++) {
      const sums: Lab[] = [
        [0, 0, 0],
        [0, 0, 0],
      ];
      const counts = [0, 0];
      for (const [which, image] of [a, b].entries()) {
        for (
          let y = Math.floor((row * image.height) / 3);
          y < Math.floor(((row + 1) * image.height) / 3);
          y++
        )
          for (
            let x = Math.floor((column * image.width) / 3);
            x < Math.floor(((column + 1) * image.width) / 3);
            x++
          ) {
            const offset = (y * image.width + x) * 4;
            if (image.data[offset + 3] < 128) continue;
            const lab = rgbToLab(image.data.subarray(offset, offset + 3));
            for (let c = 0; c < 3; c++) sums[which][c] += lab[c];
            counts[which]++;
          }
      }
      if (Math.min(...counts) < 32) continue;
      const mean = sums.map((sum, i) => sum.map((c) => c / counts[i]) as Lab);
      regions.push({
        row,
        column,
        deltaE: deltaE2000(mean[0], mean[1]),
        pixels: Math.min(...counts),
      });
    }
  if (!regions.length) throw new Error('Insufficient overlapping object regions');
  const weight = regions.reduce((sum, r) => sum + r.pixels, 0);
  return {
    meanDeltaE: regions.reduce((sum, r) => sum + r.deltaE * r.pixels, 0) / weight,
    maxDeltaE: Math.max(...regions.map((r) => r.deltaE)),
    regions,
  };
}

export function reportHtml(report: FidelityReport, comparison?: Uint8Array): string {
  const escapeHtml = (s: string) =>
    s.replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
    );
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Material fidelity review</title><h1>${report.isFlagged ? 'Review flagged' : 'No threshold exceeded'}</h1><p>Advisory only. Publication is never blocked. Left: source object. Right: neutral CPU render.</p>${comparison ? `<img alt="Source photo and neutral model render" width="768" src="data:image/png;base64,${Buffer.from(comparison).toString('base64')}">` : '<p>Comparison unavailable; review manually.</p>'}<pre>${escapeHtml(JSON.stringify(report, null, 2))}</pre></html>`;
}

export async function assessFidelity(
  bytes: Uint8Array,
  photo: Uint8Array,
  options: { context?: string; azimuth?: number; elevation?: number } = {},
): Promise<FidelityArtifacts> {
  try {
    const source = await photoPixels(photo, 192);
    const mask = objectMask(source);
    const photoFraction = mask.reduce((sum, value) => sum + value, 0) / mask.length;
    const normalized = normalizeObject(source, mask);
    const scene = await readRenderScene(bytes);
    const warnings = [...scene.warnings];
    if (photoFraction < FIDELITY_THRESHOLDS.minMaskFraction || photoFraction > 0.95)
      warnings.push('uncertain_photo_mask');
    const elevation = options.elevation ?? 15;
    const angles = options.azimuth === undefined ? [30, 90, 150, 210, 270, 330] : [options.azimuth];
    let best: { image: Pixels; score: number; azimuth: number } | undefined;
    const renderStartedAt = Date.now();
    for (const azimuth of angles) {
      if (Date.now() - renderStartedAt > 12_000)
        throw new Error('QA camera search budget exceeded');
      const image = renderNeutral(scene, azimuth, elevation);
      const score = overlap(normalized, image);
      if (!best || score > best.score) best = { image, score, azimuth };
    }
    if (!best) throw new Error('No camera');
    const color = compareRegions(normalized, best.image);
    if (color.meanDeltaE > FIDELITY_THRESHOLDS.meanDeltaE) warnings.push('mean_delta_e');
    if (color.maxDeltaE > FIDELITY_THRESHOLDS.regionDeltaE) warnings.push('region_delta_e');
    if (best.score < FIDELITY_THRESHOLDS.minSilhouetteIoU)
      warnings.push('camera_or_geometry_mismatch');
    const materials = await inspectMaterials(bytes, options.context);
    warnings.push(...materials.flatMap((m) => m.warnings.map((w) => `material_${m.index}:${w}`)));
    const decision = detectMaterial('', options.context);
    let photoMetal = 0,
      photoObject = 0;
    for (let p = 0; p < mask.length; p++)
      if (mask[p]) {
        photoObject++;
        if (isMetalColor(source.data.subarray(p * 4, p * 4 + 3), decision.kind)) photoMetal++;
      }
    const photoMetalFraction = photoMetal / Math.max(1, photoObject);
    if (photoMetalFraction > 0.03 && materials.every((m) => m.metalFraction < 0.01))
      warnings.push('photo_metal_coverage_review');
    const report: FidelityReport = {
      version: 1,
      status: 'measured',
      isFlagged: warnings.length > 0,
      warnings,
      thresholds: FIDELITY_THRESHOLDS,
      geometryHash: geometryHash(bytes),
      camera: {
        azimuth: best.azimuth,
        elevation,
        method: options.azimuth === undefined ? 'silhouette-search' : 'supplied',
        silhouetteIoU: best.score,
      },
      color,
      photoMetalFraction,
      materials,
    };
    const comparison = await sharp({
      create: { width: 384, height: 192, channels: 4, background: '#eeeeee' },
    })
      .composite([
        { input: await png(normalized), left: 0, top: 0 },
        { input: await png(best.image), left: 192, top: 0 },
      ])
      .png()
      .toBuffer();
    return { report, comparison, html: reportHtml(report, comparison) };
  } catch {
    // No exception details (URLs, source names or provider responses) go into a persisted report.
    const report = unavailableReport('qa_unavailable_review_manually');
    return { report, html: reportHtml(report) };
  }
}
