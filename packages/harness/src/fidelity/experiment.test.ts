import { describe, expect, it } from 'vitest';
import { BUILD_MODEL } from '../models';
import { fidelityExperiment } from './experiment';

describe('material fidelity experiment', () => {
  it('compares the current ten-image input against the original photo with two sampling budgets', () => {
    const plans = fidelityExperiment(
      'source',
      Array.from({ length: 9 }, (_, i) => `view-${i}`),
      2,
    );
    expect(plans.map((p) => p.request.input.images.length)).toEqual([10, 1, 1]);
    expect(plans[0].request.input.images[0]).toBe('source');
    expect(plans[1].request.input.images).toEqual(['source']);
    expect(plans[2].request.input).toMatchObject({ slat_sampling_steps: 24 });
    for (const plan of plans) {
      expect(plan.request.version).toBe(BUILD_MODEL.version);
      expect(plan.request.input).toMatchObject({ texture_size: 2048, seed: 42 });
    }
    expect(plans.reduce((sum, p) => sum + p.reservedUsd, 0)).toBeLessThan(2);
  });

  it('refuses an incomplete baseline or a budget that cannot reserve every attempt', () => {
    const views = new Array<string>(9).fill('view');
    for (const cap of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 0.1])
      expect(() => fidelityExperiment('source', views, cap)).toThrow();
    expect(() => fidelityExperiment('source', [], 2)).toThrow();
    expect(() => fidelityExperiment('', views, 2)).toThrow();
  });
});
