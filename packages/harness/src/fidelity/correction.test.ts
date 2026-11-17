import { describe, expect, it } from 'vitest';
import { correctFidelity, surfaceConfidence } from './correction';
import { fixture } from './fixtures.test-support';
import {
  appendTexture,
  geometryHash,
  readDocument,
  textureBytes,
  writeDocument,
} from './glb-document';
import { png } from './images';
import { readRenderScene, renderNeutral } from './renderer';

// The default 15s render budget and the 20s test timeout are wall clock, so a loaded CI runner
// (these tests take 16-18s there) can turn an `accepted` verdict into `skipped`. Tests that assert
// a verdict get room on both (a 60_000 literal, so biome keeps the one-line `it(...)` layout).
const ROOMY = { budgetMs: 120_000 };

async function sample() {
  const { bytes } = await fixture('wood');
  const doc = readDocument(bytes);
  const data = new Uint8Array(128 * 128 * 4);
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      const grain = Math.sin(x * 0.8 + Math.sin(y * 0.15)) * 12;
      data.set([115 + grain, 65 + grain, 35 + grain, 255], (y * 128 + x) * 4);
    }
  const pbr = doc.json.materials?.[0].pbrMetallicRoughness;
  if (!pbr) throw new Error('Missing fixture material');
  pbr.baseColorTexture = {
    index: appendTexture(doc, await png({ data, width: 128, height: 128 })),
  };
  const target = writeDocument(doc);
  const photo = await png(renderNeutral(await readRenderScene(target), 0, 0, 256));
  for (let p = 0; p < 128 * 128; p++) data.set([145, 105, 65, 255], p * 4);
  pbr.baseColorTexture = {
    index: appendTexture(doc, await png({ data, width: 128, height: 128 })),
  };
  return { bytes: writeDocument(doc), photo };
}

describe('source-photo correction loop', () => {
  it('does not transfer across an internal crease even when the silhouette matches', () => {
    const ids = new Int32Array(32 * 32);
    for (let y = 0; y < 32; y++) for (let x = 16; x < 32; x++) ids[y * 32 + x] = 1;
    const confidence = surfaceConfidence(
      ids,
      [
        [0, 0, 1],
        [0, 1, 0],
      ],
      32,
    );
    expect(confidence(15, 16)).toBe(0);
    expect(confidence(12, 16)).toBeLessThan(0.5);
    expect(confidence(5, 16)).toBe(1);
  });

  it('corrects a faded texture, remeasures it, and keeps the geometry byte-for-byte', async () => {
    const { bytes, photo } = await sample();
    const result = await correctFidelity(bytes, photo, ROOMY);
    expect(result.report.status).toBe('accepted');
    if (!result.report.before || !result.report.after) throw new Error('Missing measurements');
    expect(result.report.after.meanDeltaE).toBeLessThan(result.report.before.meanDeltaE * 0.8);
    expect(result.report.after.detailError).toBeLessThan(result.report.before.detailError);
    expect(result.report.changedTexels).toBeGreaterThan(100);
    expect(geometryHash(result.bytes)).toBe(geometryHash(bytes));
  }, 60_000);
  it('preserves the input when the photo mask or camera is unreliable', async () => {
    const { bytes } = await sample();
    const blank = await png({ width: 64, height: 64, data: new Uint8Array(64 * 64 * 4).fill(255) });
    const result = await correctFidelity(bytes, blank);
    expect(result.bytes).toEqual(bytes);
    expect(result.report.status).toBe('skipped');
    expect(result.report.reason).toBe('uncertain_photo_mask');
  });
  it('never changes unsupported transformed or translucent materials', async () => {
    const { bytes, photo } = await sample();
    const doc = readDocument(bytes);
    const material = doc.json.materials?.[0];
    if (!material) throw new Error('Missing fixture material');
    material.alphaMode = 'BLEND';
    const input = writeDocument(doc);
    const result = await correctFidelity(input, photo);
    expect(result.bytes).toEqual(input);
    expect(result.report.status).toBe('skipped');
  });
  it('preserves the original if the resource budget is exhausted', async () => {
    const { bytes, photo } = await sample();
    const result = await correctFidelity(bytes, photo, { budgetMs: 0 });
    expect(result.bytes).toEqual(bytes);
    expect(result.report.reason).toBe('correction_budget_exceeded');
  });
  it('does not repaint a hidden surface that reuses the visible surface UVs', async () => {
    const { bytes, photo } = await sample();
    const doc = readDocument(bytes);
    doc.json.nodes?.push({ mesh: 0, translation: [0, 0, -0.5] });
    doc.json.scenes?.[0].nodes?.push(1);
    const input = writeDocument(doc);
    const result = await correctFidelity(input, photo);
    expect(result.bytes).toEqual(input);
    expect(result.report.reason).toBe('insufficient_safe_texels');
    expect(result.report.changedTexels).toBe(0);
  }, 20_000);
  it('corrects the visible material while preserving a hidden material sharing its texture', async () => {
    const { bytes, photo } = await sample();
    const doc = readDocument(bytes);
    const material = doc.json.materials?.[0];
    const primitive = doc.json.meshes?.[0].primitives[0];
    const index = material?.pbrMetallicRoughness?.baseColorTexture?.index;
    if (!material || !primitive || index === undefined) throw new Error('Missing fixture');
    doc.json.materials?.push(structuredClone(material));
    doc.json.meshes?.push({ primitives: [{ ...structuredClone(primitive), material: 1 }] });
    doc.json.nodes?.push({ mesh: 1, translation: [0, 0, -0.5] });
    doc.json.scenes?.[0].nodes?.push(1);
    const input = writeDocument(doc);
    const result = await correctFidelity(input, photo, ROOMY);
    expect(result.report.status).toBe('accepted');
    const out = readDocument(result.bytes);
    expect(out.json.materials?.[1].pbrMetallicRoughness?.baseColorTexture?.index).toBe(index);
    expect(textureBytes(out, index)).toEqual(textureBytes(doc, index));
    expect(geometryHash(result.bytes)).toBe(geometryHash(input));
  }, 60_000);
  it('preserves a faithful model when no meaningful improvement can be verified', async () => {
    const { bytes } = await sample();
    const photo = await png(renderNeutral(await readRenderScene(bytes, 512), 0, 0, 256));
    const result = await correctFidelity(bytes, photo, ROOMY);
    expect(result.bytes).toEqual(bytes);
    expect(result.report.status).toBe('rejected');
    expect(result.report.reason).toBe('no_verified_improvement');
    expect(result.report.changedTexels).toBe(0);
  }, 60_000);
  it('skips transformed UVs instead of projecting into the wrong texture coordinates', async () => {
    const { bytes, photo } = await sample();
    const doc = readDocument(bytes);
    const info = doc.json.materials?.[0].pbrMetallicRoughness?.baseColorTexture;
    if (!info) throw new Error('Missing texture');
    info.extensions = { KHR_texture_transform: { offset: [0.1, 0.2] } };
    doc.json.extensionsUsed = ['KHR_texture_transform'];
    const input = writeDocument(doc);
    const result = await correctFidelity(input, photo);
    expect(result.bytes).toEqual(input);
    expect(result.report.status).toBe('skipped');
  }, 20_000);
});
