import type { Render } from '@easyrender/db';
import type { GlbMeasures, PhotoMeasures, SheetMeasures } from '@easyrender/harness';

import type { StoredFidelity } from './render-fidelity';

// What the guardrails measured on one render, stored on `Render.quality`. It is a quality signal
// to read afterwards (which renders had near-duplicate views, which fell back to the draft); it
// also records the bounded automatic sheet recovery. Every field is optional because a render
// only fills in the stages it has reached.
export type RenderQuality = {
  photo?: PhotoMeasures & { warnings: string[] };
  // The free draft sheet, and the 2K redraw a paid build makes.
  draftSheet?: SheetMeasures & { warnings: string[] };
  // One recovery of an invalid initial sheet at EasyRender's cost. Not a paid user redraw.
  sheetRecoveryAttempts?: number;
  // Set with the ledger refund after a paid correction fails. Cleared when another is requested.
  refundedCorrectionCredits?: number;
  failedStep?: 'preview' | 'model';
  finalSheet?: SheetMeasures & { warnings: string[] };
  // True when the paid build went on with the draft because the redraw failed or was rejected;
  // `finalSheetProblem` says why (a guardrail code, or the model's own failure).
  isDraftUsed?: boolean;
  finalSheetProblem?: string;
  glb?: GlbMeasures;
  fidelity?: StoredFidelity;
};

export function storedQuality(render: Pick<Render, 'quality'>): RenderQuality {
  const value = render.quality;
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RenderQuality)
    : {};
}

// The current stored measurements with one stage added, ready to write back.
export function withQuality(render: Pick<Render, 'quality'>, patch: RenderQuality): RenderQuality {
  return { ...storedQuality(render), ...patch };
}
