import { describe, expect, it } from 'vitest';
import { PUBLIC_MODEL_VERSION, versionedPublicModel } from './public-models';
import { SHOWCASE } from './showcase';
import { modelUrl } from './studio/catalog';

describe('public GLB cache version', () => {
  it('gives a replaced showcase GLB a new URL and leaves photos and colliders alone', () => {
    expect(versionedPublicModel('/showcase/armchair.glb')).toBe(
      `/showcase/armchair.glb?v=${PUBLIC_MODEL_VERSION}`,
    );
    expect(versionedPublicModel('/studio/photos/armchair.jpg')).toBe('/studio/photos/armchair.jpg');
    expect(versionedPublicModel('/studio/models/armchair.hull.json')).toBe(
      '/studio/models/armchair.hull.json',
    );
  });

  it('points the demo armchair and its studio copies at the corrected file', () => {
    const armchair = SHOWCASE.find((entry) => entry.slug === 'armchair');
    expect(armchair?.model).toBe(`/showcase/armchair.glb?v=${PUBLIC_MODEL_VERSION}`);
    expect(modelUrl('armchair.glb')).toBe(`/studio/models/armchair.glb?v=${PUBLIC_MODEL_VERSION}`);
    expect(modelUrl('armchair.hd.glb')).toBe(
      `/studio/models/armchair.hd.glb?v=${PUBLIC_MODEL_VERSION}`,
    );
    expect(modelUrl('armchair.hull.json')).toBe('/studio/models/armchair.hull.json');
  });
});
