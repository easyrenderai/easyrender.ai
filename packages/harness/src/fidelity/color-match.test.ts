import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { matchColorToPhoto } from './color-match';
import { fixture } from './fixtures.test-support';
import {
  appendTexture,
  geometryHash,
  readDocument,
  textureBytes,
  writeDocument,
} from './glb-document';
import { png } from './images';

// A one-material model whose texture is a flat colour, and a photo of a flat object on white.
async function modelWithColor(rgb: [number, number, number]) {
  const { bytes } = await fixture('upholstery');
  const doc = readDocument(bytes);
  const data = new Uint8Array(32 * 32 * 4);
  for (let p = 0; p < 32 * 32; p++) data.set([...rgb, 255], p * 4);
  const pbr = doc.json.materials?.[0].pbrMetallicRoughness;
  if (!pbr) throw new Error('Missing fixture material');
  pbr.baseColorTexture = { index: appendTexture(doc, await png({ data, width: 32, height: 32 })) };
  return writeDocument(doc);
}
async function photoOfColor(rgb: [number, number, number]) {
  const data = new Uint8Array(64 * 64 * 4).fill(255);
  for (let y = 12; y < 52; y++)
    for (let x = 12; x < 52; x++) data.set([...rgb, 255], (y * 64 + x) * 4);
  return png({ data, width: 64, height: 64 });
}
async function textureColor(bytes: Uint8Array) {
  const doc = readDocument(bytes);
  const index = doc.json.materials?.[0].pbrMetallicRoughness?.baseColorTexture?.index ?? 0;
  const { data } = await sharp(textureBytes(doc, index)).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  return [data[0], data[1], data[2]];
}

describe('whole-object colour match', () => {
  it('lifts a darkened texture to the photo colour and leaves the geometry untouched', async () => {
    const model = await modelWithColor([135, 90, 55]);
    const photo = await photoOfColor([180, 128, 78]);
    const { bytes, report } = await matchColorToPhoto(model, photo);
    expect(report.status).toBe('applied');
    expect(report.afterDeltaE).toBeLessThan(report.beforeDeltaE ?? 0);
    const [r, g, b] = await textureColor(bytes);
    // Brighter than the model, and moving towards the photo on every channel.
    expect(r).toBeGreaterThan(135);
    expect(g).toBeGreaterThan(90);
    expect(b).toBeGreaterThan(55);
    expect(r).toBeLessThanOrEqual(185);
    expect(geometryHash(bytes)).toBe(geometryHash(model));
  });

  it('keeps a texture that already matches the photo', async () => {
    const model = await modelWithColor([180, 128, 78]);
    const result = await matchColorToPhoto(model, await photoOfColor([176, 126, 80]));
    expect(result.report).toMatchObject({ status: 'skipped', reason: 'already_close' });
    expect(result.bytes).toBe(model);
  });

  it('does nothing when the photo has no clear object', async () => {
    const model = await modelWithColor([135, 90, 55]);
    const blank = await png({ data: new Uint8Array(32 * 32 * 4).fill(255), width: 32, height: 32 });
    const result = await matchColorToPhoto(model, blank);
    expect(result.report).toMatchObject({ status: 'skipped', reason: 'uncertain_photo_mask' });
    expect(result.bytes).toBe(model);
  });

  it('keeps the original when the photo is a very different colour', async () => {
    const model = await modelWithColor([20, 20, 20]);
    const result = await matchColorToPhoto(model, await photoOfColor([230, 60, 60]));
    expect(result.report.status).toBe('skipped');
    expect(result.bytes).toBe(model);
  });

  it('keeps a model without a base-colour texture', async () => {
    const { bytes } = await fixture('plain');
    const doc = readDocument(bytes);
    const pbr = doc.json.materials?.[0].pbrMetallicRoughness;
    if (pbr) delete pbr.baseColorTexture;
    const plain = writeDocument(doc);
    const result = await matchColorToPhoto(plain, await photoOfColor([180, 128, 78]));
    expect(result.report).toMatchObject({ status: 'skipped', reason: 'no_base_color_texture' });
  });
});
