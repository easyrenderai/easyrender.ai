import { readFileSync } from 'node:fs';
import { measureGlb } from '@easyrender/harness';
import { describe, expect, it } from 'vitest';
import { parseCatalogItems } from './catalog';
import { isServedChanged, servedModel } from './render-materials';

const armchair = () =>
  new Uint8Array(
    readFileSync(new URL('../../../apps/web/public/showcase/armchair.glb', import.meta.url)),
  );

describe('serving a model at its real size', () => {
  it('scales the file the viewer gets, and leaves the stored one alone', () => {
    const original = armchair();
    const served = servedModel({ materialEdits: null, sizeCm: { heightCm: 90 } }, original);
    expect(measureGlb(served)?.height).toBeCloseTo(0.9, 3);
    expect(measureGlb(original)?.height).toBeCloseTo(0.77, 3);
  });

  it('serves the stored size on top of material edits', () => {
    const edits = [{ index: 0, roughness: 0.2 }];
    const served = servedModel({ materialEdits: edits, sizeCm: { heightCm: 50 } }, armchair());
    expect(measureGlb(served)?.height).toBeCloseTo(0.5, 3);
  });

  it('ignores a stored size that is not a size', () => {
    const original = armchair();
    const served = servedModel({ materialEdits: null, sizeCm: { heightCm: 'tall' } }, original);
    expect(served).toBe(original);
  });

  it('tells the route to skip its cache only when the file differs from the stored one', () => {
    expect(isServedChanged({ materialEdits: null, sizeCm: null })).toBe(false);
    expect(isServedChanged({ materialEdits: [], sizeCm: null })).toBe(false);
    expect(isServedChanged({ materialEdits: null, sizeCm: { heightCm: 90 } })).toBe(true);
    expect(isServedChanged({ materialEdits: [{ index: 0 }], sizeCm: null })).toBe(true);
  });
});

describe('product sizes sent by a store', () => {
  const base = { externalId: 'p1', title: 'Chair', imageUrl: 'https://cdn.shop.test/p1.jpg' };

  it('keeps the sides that make sense and drops blank, zero and absurd ones', () => {
    const [item] = parseCatalogItems([
      { ...base, sizeCm: { widthCm: 50, depthCm: 0, heightCm: 90, extra: 5 } },
    ]);
    expect(item?.sizeCm).toEqual({ widthCm: 50, heightCm: 90 });
    const [giant] = parseCatalogItems([{ ...base, sizeCm: { heightCm: 99999 } }]);
    expect(giant).not.toHaveProperty('sizeCm');
  });

  it('accepts a product with no size', () => {
    const [item] = parseCatalogItems([base]);
    expect(item).not.toHaveProperty('sizeCm');
  });
});
