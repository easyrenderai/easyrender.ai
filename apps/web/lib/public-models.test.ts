import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PUBLIC_MODEL_VERSION, PUBLIC_PHOTO_VERSION, versionedPublicModel } from './public-models';
import { SHOWCASE } from './showcase';
import { modelUrl } from './studio/catalog';

function jpegSize(buffer: Buffer) {
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1] ?? 0;
    const length = buffer.readUInt16BE(offset + 2);
    if (marker === 0xc0 || marker === 0xc2) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new Error('JPEG size marker not found');
}

describe('public GLB cache version', () => {
  it('gives a replaced showcase GLB a new URL and leaves other photos and colliders alone', () => {
    expect(versionedPublicModel('/showcase/armchair.glb')).toBe(
      `/showcase/armchair.glb?v=${PUBLIC_MODEL_VERSION}`,
    );
    expect(versionedPublicModel('/showcase/armchair.jpg')).toBe(
      `/showcase/armchair.jpg?v=${PUBLIC_PHOTO_VERSION}`,
    );
    expect(versionedPublicModel('/showcase/vase.jpg')).toBe('/showcase/vase.jpg');
    expect(versionedPublicModel('/studio/photos/armchair.jpg')).toBe('/studio/photos/armchair.jpg');
    expect(versionedPublicModel('/studio/models/armchair.hull.json')).toBe(
      '/studio/models/armchair.hull.json',
    );
  });

  it('points the demo armchair and its studio copies at the corrected file', () => {
    const armchair = SHOWCASE.find((entry) => entry.slug === 'armchair');
    expect(armchair?.model).toBe(`/showcase/armchair.glb?v=${PUBLIC_MODEL_VERSION}`);
    expect(armchair?.photo).toBe(`/showcase/armchair.jpg?v=${PUBLIC_PHOTO_VERSION}`);
    expect(modelUrl('armchair.glb')).toBe(`/studio/models/armchair.glb?v=${PUBLIC_MODEL_VERSION}`);
    expect(modelUrl('armchair.hd.glb')).toBe(
      `/studio/models/armchair.hd.glb?v=${PUBLIC_MODEL_VERSION}`,
    );
    expect(modelUrl('armchair.hull.json')).toBe('/studio/models/armchair.hull.json');
  });

  it('keeps the armchair source photo large enough for a retina desktop card', () => {
    const file = readFileSync(new URL('../public/showcase/armchair.jpg', import.meta.url));
    expect(jpegSize(file)).toEqual({ width: 2048, height: 2048 });
  });
});
