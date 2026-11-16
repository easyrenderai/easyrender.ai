import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { detectMaterial, isMetalColor } from './detection';
import { fixture } from './fixtures.test-support';
import {
  appendTexture,
  assertGeometryUnchanged,
  geometryHash,
  readDocument,
  textureBytes,
  writeDocument,
} from './glb-document';
import { pixels, png } from './images';
import { improveMaterials, inspectMaterials } from './materials';

describe('material decisions', () => {
  it.each([
    'steel',
    'stainless',
    'iron',
    'chrome',
    'aluminium',
    'aluminum',
    'acero',
    'inox',
    'hierro',
  ])('recognises %s hints', (text) => expect(detectMaterial(text).kind).toBe('neutral'));
  it.each(['brass', 'latón'])('recognises %s', (text) =>
    expect(detectMaterial(text).kind).toBe('brass'),
  );
  it.each(['copper', 'cobre'])('recognises %s', (text) =>
    expect(detectMaterial(text).kind).toBe('copper'),
  );
  it('keeps glossy plastic and coated metal dielectric, even in a metal product', () => {
    expect(detectMaterial('glossy black plastic', 'steel chair').kind).toBe('dielectric');
    expect(detectMaterial('painted steel').kind).toBe('dielectric');
    expect(detectMaterial('powder-coated iron').kind).toBe('dielectric');
    expect(isMetalColor([20, 20, 20], 'neutral')).toBe(false);
    expect(detectMaterial('steel and plastic grips').kind).toBe('neutral');
    expect(detectMaterial('shiny grey base').kind).toBe('unknown');
    expect(detectMaterial('ironing board').kind).toBe('unknown');
  });
});

describe('material output', () => {
  it('adds varied roughness and fine metal-only normals without changing geometry or albedo', async () => {
    const { bytes, photo } = await fixture();
    const pass = await improveMaterials(bytes, photo);
    expect(pass.materials[0].metalFraction).toBeGreaterThan(0.1);
    expect(pass.materials[0].metalFraction).toBeLessThan(0.9);
    expect(pass.materials[0].roughness.std).toBeGreaterThan(0.008);
    const before = readDocument(bytes),
      after = readDocument(pass.bytes);
    expect(textureBytes(before, 0)).toEqual(textureBytes(after, 0));
    expect(after.json.materials?.[0].pbrMetallicRoughness?.metallicFactor).toBe(1);
    expect(after.json.materials?.[0].normalTexture).toBeDefined();
    const normal = await pixels(
      textureBytes(after, after.json.materials?.[0].normalTexture?.index ?? -1),
    );
    const red = [...normal.data].filter((_, i) => i % 4 === 0);
    expect(Math.max(...red) - Math.min(...red)).toBeLessThanOrEqual(6);
    expect(assertGeometryUnchanged(bytes, pass.bytes)).toBe(geometryHash(bytes));
  });
  it('does not infer metal from a bright photo without a hint, and always varies dielectric roughness', async () => {
    const { bytes, photo } = await fixture('glossy black plastic base');
    const pass = await improveMaterials(bytes, photo, 'steel swivel chair');
    expect(pass.materials[0].metalFraction).toBe(0);
    expect(pass.materials[0].roughness.std).toBeGreaterThan(0.008);
    expect(readDocument(pass.bytes).json.materials?.[0].normalTexture).toBeUndefined();
    const unknown = await fixture('material_0');
    const result = await improveMaterials(unknown.bytes, unknown.photo);
    expect(result.materials[0].metalFraction).toBe(0);
    expect(result.warnings).toContain('material_0:material_identity_unknown');
  });
  it('requires source photo evidence before applying a metal hint', async () => {
    const { bytes } = await fixture('brass');
    const { photo } = await fixture();
    const pass = await improveMaterials(bytes, photo);
    expect(pass.materials[0].metalFraction).toBe(0);
    expect(pass.warnings).toContain('material_0:metal_hint_without_photo_evidence');
  });
  it('reports flat/missing maps before and varied maps after', async () => {
    const { bytes, photo } = await fixture('wood');
    expect((await inspectMaterials(bytes))[0].warnings).toContain('flat_roughness');
    const after = await improveMaterials(bytes, photo);
    expect((await inspectMaterials(after.bytes))[0].warnings).not.toContain('flat_roughness');
  });
});

describe('metal sanity calibration', () => {
  it('flags weak, flat, over-polished brushed metal and repairs it with a varied binary response', async () => {
    const { bytes, photo } = await fixture();
    const doc = readDocument(bytes);
    const data = new Uint8Array(256 * 256 * 4);
    for (let p = 0; p < 256 * 256; p++) data.set([255, 50, 180, 255], p * 4);
    const index = appendTexture(doc, await png({ data, width: 256, height: 256 }));
    const pbr = doc.json.materials?.[0].pbrMetallicRoughness;
    if (!pbr) throw new Error('Missing fixture material');
    pbr.metallicRoughnessTexture = { index };
    pbr.roughnessFactor = 1;
    pbr.metallicFactor = 1;
    const flat = writeDocument(doc);
    expect((await inspectMaterials(flat))[0].warnings).toEqual(
      expect.arrayContaining([
        'flat_metal_roughness',
        'weak_metal_response',
        'brushed_metal_roughness',
      ]),
    );
    const result = await improveMaterials(flat, photo);
    const measured = (await inspectMaterials(result.bytes))[0];
    expect(measured.metalResponseMean).toBe(1);
    expect(measured.metalRoughness?.std).toBeGreaterThan(0.008);
    expect(measured.metalRoughness?.mean).toBeGreaterThan(0.25);
    expect(measured.warnings).not.toContain('brushed_metal_roughness');
  });
});

describe('geometry guard', () => {
  it.each([0, 48, 96, 128])(
    'rejects changed positions, normals, UVs or indices at offset %i',
    async (offset) => {
      const { bytes } = await fixture();
      const doc = readDocument(bytes);
      doc.binary[offset] ^= 1;
      expect(() => assertGeometryUnchanged(bytes, writeDocument(doc))).toThrow('changed geometry');
    },
  );
  it('rejects node transforms and accessor interpretation changes', async () => {
    const { bytes } = await fixture();
    const doc = readDocument(bytes);
    if (doc.json.nodes?.[0]) doc.json.nodes[0].translation = [1, 0, 0];
    expect(() => assertGeometryUnchanged(bytes, writeDocument(doc))).toThrow('changed geometry');
    const other = readDocument(bytes);
    if (other.json.accessors?.[0]) other.json.accessors[0].normalized = true;
    expect(() => assertGeometryUnchanged(bytes, writeDocument(other))).toThrow('changed geometry');
  });
  it('covers compressed showcase buffers and keeps glossy black plastic dielectric', async () => {
    const root = new URL('../../../../apps/web/public/studio/', import.meta.url);
    const bytes = await readFile(new URL('models/swivel-chair.glb', root));
    const photo = await readFile(new URL('photos/swivel-chair.jpg', root));
    const pass = await improveMaterials(bytes, photo, 'fabric with glossy black plastic base');
    expect(pass.materials[0].metalFraction).toBe(0);
    expect(assertGeometryUnchanged(bytes, pass.bytes)).toBe(pass.geometryHash);
    const doc = readDocument(bytes);
    const compressed = doc.json.bufferViews?.find((v) => v.extensions?.EXT_meshopt_compression)
      ?.extensions?.EXT_meshopt_compression as { byteOffset: number };
    doc.binary[compressed.byteOffset ?? 0] ^= 1;
    expect(() => assertGeometryUnchanged(bytes, writeDocument(doc))).toThrow('changed geometry');
  });
});
