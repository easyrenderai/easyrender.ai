import sharp from 'sharp';
import { linear, srgb } from './color';
import { detectMaterial, isMetalColor, type MaterialDecision } from './detection';
import {
  appendTexture,
  assertGeometryUnchanged,
  readDocument,
  textureBytes,
  writeDocument,
} from './glb-document';
import { objectMask, photoPixels, pixels, png, statistics } from './images';
import { FIDELITY_THRESHOLDS } from './thresholds';

export type MaterialMeasure = {
  index: number;
  decision: MaterialDecision;
  metalFraction: number;
  expectedMetalFraction: number;
  roughness: ReturnType<typeof statistics>;
  metalRoughness?: ReturnType<typeof statistics>;
  metalResponseMean?: number;
  warnings: string[];
};
export type MaterialPass = {
  bytes: Uint8Array;
  geometryHash: string;
  materials: MaterialMeasure[];
  warnings: string[];
};
const SIZE = 256;
const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

// Deterministic fine variation, no broad grooves/bands. An unchanged source yields identical maps.
function grain(x: number, y: number) {
  let seed = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
  seed = Math.imul(seed ^ (seed >>> 13), 1274126177);
  return ((seed ^ (seed >>> 16)) >>> 0) / 4294967295 - 0.5;
}

export async function improveMaterials(
  bytes: Uint8Array,
  photo: Uint8Array,
  context = '',
): Promise<MaterialPass> {
  const startedAt = Date.now();
  const doc = readDocument(bytes);
  const source = await photoPixels(photo);
  const mask = objectMask(source);
  const measures: MaterialMeasure[] = [];
  const warnings: string[] = [];
  if (!doc.json.materials?.length) throw new Error('No explicit GLB materials');
  if (doc.json.materials.length > 64) throw new Error('Material budget exceeded');
  for (const [index, material] of doc.json.materials.entries()) {
    if (Date.now() - startedAt > 10_000) throw new Error('Material processing budget exceeded');
    const decision = detectMaterial(material.name ?? '', context);
    material.pbrMetallicRoughness ??= {};
    const pbr = material.pbrMetallicRoughness;
    const materialWarnings: string[] = [];
    const originalInfo = pbr.metallicRoughnessTexture;
    const baseInfo = pbr.baseColorTexture;
    const hasMatchingUvs =
      !originalInfo ||
      !baseInfo ||
      ((originalInfo.texCoord ?? 0) === (baseInfo.texCoord ?? 0) &&
        JSON.stringify(originalInfo.extensions ?? {}) ===
          JSON.stringify(baseInfo.extensions ?? {}));
    // Preserve native map resolution so satin micro-detail survives the material pass.
    const image = originalInfo
      ? textureBytes(doc, originalInfo.index)
      : baseInfo
        ? textureBytes(doc, baseInfo.index)
        : null;
    const metadata = image ? await sharp(image).metadata() : null;
    const width = Math.max(256, metadata?.width ?? SIZE),
      height = Math.max(256, metadata?.height ?? SIZE);
    if (width * height > 4_194_304) throw new Error('Material texture budget exceeded');
    const area = width * height;
    const color = baseInfo ? await pixels(textureBytes(doc, baseInfo.index), width, height) : null;
    const previous = originalInfo
      ? await pixels(textureBytes(doc, originalInfo.index), width, height)
      : null;
    const hasMetalHint = !['unknown', 'dielectric'].includes(decision.kind);
    let sourceCandidates = 0;
    for (let p = 0; p < mask.length; p++) {
      if (mask[p] && isMetalColor(source.data.subarray(p * 4, p * 4 + 3), decision.kind))
        sourceCandidates++;
    }
    const hasSourceEvidence = sourceCandidates >= 16;
    if (hasMetalHint && !hasSourceEvidence)
      materialWarnings.push('metal_hint_without_photo_evidence');
    if (decision.kind === 'unknown' && !previous)
      materialWarnings.push('material_identity_unknown');
    if (!hasMatchingUvs) materialWarnings.push('different_texture_coordinates');
    const uses =
      doc.json.meshes?.flatMap((mesh) => mesh.primitives).filter((p) => p.material === index) ?? [];
    const texCoord = originalInfo?.texCoord ?? baseInfo?.texCoord ?? 0;
    if (uses.some((p) => p.attributes[`TEXCOORD_${texCoord}`] === undefined)) {
      materialWarnings.push('missing_uvs_cannot_add_variation');
      warnings.push(`material_${index}:missing_uvs_cannot_add_variation`);
      continue;
    }
    const oldRoughness = Array.from(
      { length: area },
      (_, p) => (previous ? previous.data[p * 4 + 1] / 255 : 1) * (pbr.roughnessFactor ?? 1),
    );
    const hasVariation = statistics(oldRoughness).std >= FIDELITY_THRESHOLDS.roughnessStd;
    const map = new Uint8Array(area * 4);
    const normals = new Uint8Array(map.length);
    let metalCount = 0;
    let expectedCount = 0;
    const roughness: number[] = [];
    for (let p = 0; p < area; p++) {
      const offset = p * 4;
      const rgb = color
        ? [...color.data.subarray(offset, offset + 3)].map(
            (c, i) => 255 * srgb(linear(c / 255) * (pbr.baseColorFactor?.[i] ?? 1)),
          )
        : (pbr.baseColorFactor ?? [1, 1, 1, 1])
            .slice(0, 3)
            .map((v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055));
      const isExpectedMetal =
        hasSourceEvidence && hasMatchingUvs && isMetalColor(rgb, decision.kind);
      if (isExpectedMetal) expectedCount++;
      // Existing authored metal masks are evidence. Never turn a mixed atlas wholly metallic.
      let metallic = previous ? previous.data[offset + 2] * (pbr.metallicFactor ?? 1) : 0;
      if (decision.kind === 'dielectric') metallic = 0;
      else if (hasMetalHint && hasSourceEvidence && hasMatchingUvs)
        metallic = isExpectedMetal ? 255 : 0;
      const isMetal = metallic > 127;
      if (isMetal) metalCount++;
      const x = p % width;
      const y = Math.floor(p / width);
      let rough = oldRoughness[p];
      if (!hasVariation) {
        const center = isMetal
          ? decision.isBrushed
            ? 0.38
            : 0.3
          : Math.max(0.08, Math.min(0.9, pbr.roughnessFactor ?? 0.65));
        rough = center + grain(x, y) * 0.06;
      }
      map.set([255, clamp(rough * 255), clamp(metallic), 255], offset);
      roughness.push(map[offset + 1] / 255);
      // Fine satin micro-streaks, max tangent displacement ~0.024, only on metal texels.
      normals.set([isMetal ? clamp(128 + grain(x, 0) * 6) : 128, 128, 255, 255], offset);
    }
    // Two flat roughness values on different substrates are not surface detail. Check each
    // substrate independently, and keep the original detail when it already varies.
    for (const isMetalRegion of [false, true]) {
      const region: number[] = [];
      for (let p = 0; p < area; p++)
        if (map[p * 4 + 2] > 127 === isMetalRegion) region.push(map[p * 4 + 1] / 255);
      if (!region.length) continue;
      const stats = statistics(region);
      const shift =
        isMetalRegion &&
        decision.isBrushed &&
        (stats.mean < FIDELITY_THRESHOLDS.brushedRoughnessMin ||
          stats.mean > FIDELITY_THRESHOLDS.brushedRoughnessMax)
          ? 0.38 - stats.mean
          : 0;
      for (let p = 0; p < area; p++)
        if (map[p * 4 + 2] > 127 === isMetalRegion) {
          let rough = map[p * 4 + 1] / 255 + shift;
          if (stats.std < FIDELITY_THRESHOLDS.roughnessStd)
            rough =
              Math.max(0.04, Math.min(0.96, rough)) +
              grain(p % width, Math.floor(p / width)) * 0.06;
          map[p * 4 + 1] = clamp(rough * 255);
          roughness[p] = map[p * 4 + 1] / 255;
        }
    }
    const info = originalInfo ?? baseInfo;
    const sampler = info ? doc.json.textures?.[info.index]?.sampler : undefined;
    pbr.metallicRoughnessTexture = {
      ...(info ?? {}),
      index: appendTexture(doc, await png({ data: map, width, height }), sampler),
    };
    pbr.metallicFactor = 1;
    pbr.roughnessFactor = 1;
    if (decision.isBrushed && metalCount > 0 && !material.normalTexture)
      material.normalTexture = {
        ...(info ?? {}),
        index: appendTexture(doc, await png({ data: normals, width, height }), sampler),
        scale: 0.35,
      };
    const measure = {
      index,
      decision,
      metalFraction: metalCount / area,
      expectedMetalFraction: expectedCount / area,
      roughness: statistics(roughness),
      warnings: materialWarnings,
    };
    measures.push(measure);
    warnings.push(...materialWarnings.map((warning) => `material_${index}:${warning}`));
  }
  const output = writeDocument(doc);
  const hash = assertGeometryUnchanged(bytes, output);
  return { bytes: output, geometryHash: hash, materials: measures, warnings };
}

// Read-only QA: measures actual stored factors and maps, including mixed metal/dielectric atlases.
export async function inspectMaterials(
  bytes: Uint8Array,
  context = '',
): Promise<MaterialMeasure[]> {
  const startedAt = Date.now();
  const doc = readDocument(bytes);
  const measures: MaterialMeasure[] = [];
  for (const [index, material] of (doc.json.materials ?? []).entries()) {
    const pbr = material.pbrMetallicRoughness ?? {};
    if (Date.now() - startedAt > 10_000) throw new Error('Material processing budget exceeded');
    const decision = detectMaterial(material.name ?? '', context);
    const input = pbr.metallicRoughnessTexture
      ? textureBytes(doc, pbr.metallicRoughnessTexture.index)
      : null;
    const metadata = input ? await sharp(input).metadata() : null;
    const width = metadata?.width ?? SIZE,
      height = metadata?.height ?? SIZE;
    if (width * height > 4_194_304) throw new Error('QA texture budget exceeded');
    const area = width * height;
    const map = pbr.metallicRoughnessTexture
      ? await pixels(textureBytes(doc, pbr.metallicRoughnessTexture.index), width, height)
      : null;
    const color = pbr.baseColorTexture
      ? await pixels(textureBytes(doc, pbr.baseColorTexture.index), width, height)
      : null;
    const roughness: number[] = [];
    const metalRoughnessValues: number[] = [];
    const metalResponses: number[] = [];
    let metal = 0;
    let expected = 0;
    for (let p = 0; p < area; p++) {
      roughness.push((map ? map.data[p * 4 + 1] / 255 : 1) * (pbr.roughnessFactor ?? 1));
      const metallic = (map ? map.data[p * 4 + 2] / 255 : 1) * (pbr.metallicFactor ?? 1);
      if (metallic > 0.5) {
        metal++;
        metalResponses.push(metallic);
        metalRoughnessValues.push(roughness[p]);
      }
      if (color && isMetalColor(color.data.subarray(p * 4, p * 4 + 3), decision.kind)) expected++;
    }
    const stats = statistics(roughness);
    const warnings: string[] = [];
    const metalRoughness = statistics(metalRoughnessValues);
    const metalResponseMean = statistics(metalResponses).mean;
    if (metal > 64 && metalResponseMean < FIDELITY_THRESHOLDS.minMetalResponse)
      warnings.push('weak_metal_response');
    if (metal > 64 && metalRoughness.std < FIDELITY_THRESHOLDS.roughnessStd)
      warnings.push('flat_metal_roughness');
    if (
      metal > 64 &&
      decision.isBrushed &&
      (metalRoughness.mean < FIDELITY_THRESHOLDS.brushedRoughnessMin ||
        metalRoughness.mean > FIDELITY_THRESHOLDS.brushedRoughnessMax)
    )
      warnings.push('brushed_metal_roughness');
    if (stats.std < FIDELITY_THRESHOLDS.roughnessStd) warnings.push('flat_roughness');
    if (!map) warnings.push('missing_roughness_map');
    if (decision.kind === 'dielectric' && metal > area * 0.05)
      warnings.push('dielectric_marked_metal');
    if (expected > area * 0.05 && metal < expected * 0.5) warnings.push('metal_hint_mismatch');
    measures.push({
      index,
      decision,
      metalFraction: metal / area,
      expectedMetalFraction: expected / area,
      roughness: stats,
      metalRoughness,
      metalResponseMean,
      warnings,
    });
  }
  return measures;
}
