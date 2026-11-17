import { BUILD_MODEL, buildRequest, DEFAULT_BUILD_SETTINGS } from '../models';

export const EXPERIMENT_TIMEOUT_MS = 300_000;
// Reserve the whole timeout plus one provider-request window, including failed attempts.
// This is an estimate at the pinned model's configured rate, not a provider billing limit.
const RESERVED_USD = (EXPERIMENT_TIMEOUT_MS / 1000 + 45) * BUILD_MODEL.usdPerSecond;

export function fidelityExperiment(source: string, views: string[], capUsd: number) {
  if (!source || views.length !== 9 || views.some((view) => !view))
    throw new Error('A source photo and all nine baseline views are required');
  if (!Number.isFinite(capUsd) || capUsd < RESERVED_USD * 3)
    throw new Error(`Reserve at least ${(RESERVED_USD * 3).toFixed(3)} USD for all three attempts`);
  return [
    { id: 'current-multiview', images: [source, ...views], steps: 12 },
    { id: 'source-only', images: [source], steps: 12 },
    { id: 'source-detail', images: [source], steps: 24 },
  ].map(({ id, images, steps }) => ({
    id,
    reservedUsd: RESERVED_USD,
    request: buildRequest(images, {
      ...DEFAULT_BUILD_SETTINGS,
      input: {
        ...DEFAULT_BUILD_SETTINGS.input,
        ss_sampling_steps: steps,
        slat_sampling_steps: steps,
      },
    }),
  }));
}
