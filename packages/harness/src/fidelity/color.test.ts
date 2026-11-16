import { describe, expect, it } from 'vitest';
import { deltaE2000, type Lab, rgbToLab } from './color';
import { imageFixture } from './fixtures.test-support';
import { compareRegions } from './qa';

describe('CIEDE2000', () => {
  // Sharma/Wu/Dalal supplementary test data, pairs 1–6 and zero-chroma case.
  it.each([
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 2.8361, -74.02], [50, 0, -82.7485], 3.4412],
    [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1],
    [[50, -1.1848, -84.8006], [50, 0, -82.7485], 1],
    [[50, -0.9009, -85.5211], [50, 0, -82.7485], 1],
    [[50, 0, 0], [50, -1, 2], 2.3669],
  ])('matches reference %j', (a, b, expected) => {
    expect(deltaE2000(a as Lab, b as Lab)).toBeCloseTo(expected as number, 4);
    expect(deltaE2000(b as Lab, a as Lab)).toBeCloseTo(expected as number, 4);
  });
  it('maps sRGB black and white to D65 Lab', () => {
    expect(rgbToLab([0, 0, 0])).toEqual([0, 0, 0]);
    expect(rgbToLab([255, 255, 255])[0]).toBeCloseTo(100, 3);
  });
  it('returns zero for identical regions and detects a local tint', () => {
    const a = imageFixture(),
      b = imageFixture();
    expect(compareRegions(a, b).meanDeltaE).toBe(0);
    for (let y = 4; y < 14; y++)
      for (let x = 4; x < 14; x++) b.data.set([230, 30, 20, 255], (y * 32 + x) * 4);
    expect(compareRegions(a, b).maxDeltaE).toBeGreaterThan(20);
  });
});
