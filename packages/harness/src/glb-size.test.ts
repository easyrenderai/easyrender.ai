import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyRealSize, measureGlb, realSizeScale, sanitizeRealSize } from './glb';

const showcase = (name: string) =>
  new Uint8Array(
    readFileSync(new URL(`../../../apps/web/public/showcase/${name}.glb`, import.meta.url)),
  );

// A one-box GLB whose mesh sits under a rotated, translated parent node, built by hand.
function makeBox(min: number[], max: number[], parent: object = {}) {
  const gltf = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ children: [1], ...parent }, { mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{ min, max }],
  };
  const json = new TextEncoder().encode(JSON.stringify(gltf));
  const padded = Math.ceil(json.byteLength / 4) * 4;
  const bin = new Uint8Array([1, 2, 3, 4]);
  const out = new Uint8Array(12 + 8 + padded + 8 + bin.byteLength);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, out.byteLength, true);
  view.setUint32(12, padded, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(json, 20);
  out.fill(0x20, 20 + json.byteLength, 20 + padded);
  view.setUint32(20 + padded, bin.byteLength, true);
  view.setUint32(24 + padded, 0x004e4942, true);
  out.set(bin, 28 + padded);
  return out;
}

const close = (value: number | undefined, expected: number) =>
  expect(value).toBeCloseTo(expected, 4);

describe('measuring a GLB', () => {
  it('reads the box of the geometry and follows the parent transforms', () => {
    const plain = measureGlb(makeBox([-0.5, 0, -0.25], [0.5, 2, 0.25]));
    close(plain?.width, 1);
    close(plain?.height, 2);
    close(plain?.depth, 0.5);

    // A parent scaled by 2, then turned a quarter turn around Y: width and depth swap.
    const half = Math.SQRT1_2;
    const turned = measureGlb(
      makeBox([-0.5, 0, -0.25], [0.5, 2, 0.25], { scale: [2, 2, 2], rotation: [0, half, 0, half] }),
    );
    close(turned?.width, 1);
    close(turned?.height, 4);
    close(turned?.depth, 2);
  });

  it('returns null for something that is not a GLB', () => {
    expect(measureGlb(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it('measures a real generated model', () => {
    const size = measureGlb(showcase('armchair'));
    expect(size?.height).toBeGreaterThan(0);
  });
});

describe('putting a GLB at its real size', () => {
  it('scales by the height, and the new size is what a viewer measures', () => {
    const glb = makeBox([-0.5, 0, -0.25], [0.5, 2, 0.25]);
    const scaled = measureGlb(applyRealSize(glb, { heightCm: 90 }));
    close(scaled?.height, 0.9);
    // One scale for the whole piece: the proportions stay.
    close(scaled?.width, 0.45);
    close(scaled?.depth, 0.225);
  });

  it('copies the binary chunk untouched', () => {
    const glb = makeBox([0, 0, 0], [1, 1, 1]);
    const out = applyRealSize(glb, { heightCm: 50 });
    expect([...out.subarray(out.length - 4)]).toEqual([1, 2, 3, 4]);
  });

  it('uses the larger floor side when there is no height', () => {
    const glb = makeBox([-0.5, 0, -0.25], [0.5, 2, 0.25]);
    const scaled = measureGlb(applyRealSize(glb, { widthCm: 50, depthCm: 20 }));
    close(scaled?.width, 0.5);
  });

  it('serves the same bytes when the size cannot be applied', () => {
    const glb = makeBox([0, 0, 0], [1, 1, 1]);
    expect(applyRealSize(glb, {})).toBe(glb);
    const bad = new Uint8Array([1, 2, 3, 4]);
    expect(applyRealSize(bad, { heightCm: 50 })).toBe(bad);
  });

  it('has no scale when the model is flat on the axis it is asked about', () => {
    expect(realSizeScale({ heightCm: 50 }, { width: 1, height: 0, depth: 1 })).toBeNull();
  });
});

describe('cleaning a size', () => {
  it('keeps the sides it is given, rounded to a millimetre', () => {
    expect(sanitizeRealSize({ widthCm: 80.04, heightCm: 90 })).toEqual({
      widthCm: 80,
      heightCm: 90,
    });
  });

  it('clears on null or an empty object', () => {
    expect(sanitizeRealSize(null)).toBeNull();
    expect(sanitizeRealSize({})).toBeNull();
  });

  it('refuses text, zero, negatives and giants', () => {
    expect(sanitizeRealSize({ heightCm: '90' })).toBeUndefined();
    expect(sanitizeRealSize({ heightCm: 0 })).toBeUndefined();
    expect(sanitizeRealSize({ heightCm: -5 })).toBeUndefined();
    expect(sanitizeRealSize({ heightCm: 20000 })).toBeUndefined();
    expect(sanitizeRealSize([90])).toBeUndefined();
  });
});
