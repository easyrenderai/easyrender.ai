// Review thresholds, calibrated against the public showcase; never publication gates.
export const FIDELITY_THRESHOLDS = {
  meanDeltaE: 12,
  regionDeltaE: 20,
  roughnessStd: 0.004,
  minSilhouetteIoU: 0.55,
  minMaskFraction: 0.05,
  minMetalResponse: 0.95,
  brushedRoughnessMin: 0.25,
  brushedRoughnessMax: 0.65,
} as const;
