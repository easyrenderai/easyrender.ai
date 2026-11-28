import { AppError } from './errors';

export const MODEL_FEEDBACK_REASONS = ['shape', 'texture', 'proportions', 'other'] as const;
export type ModelFeedbackReason = (typeof MODEL_FEEDBACK_REASONS)[number];
export const MODEL_FEEDBACK_COMMENT_MAX = 1000;

export function parseModelFeedback(input: unknown): {
  rating: number | null;
  reasons: ModelFeedbackReason[];
  comment: string | null;
} {
  const invalid = () => new AppError('Invalid model feedback', 400, 'bad_feedback');
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid();
  const body = input as Record<string, unknown>;
  const keys = Object.keys(body);
  if (body.dismissed === true && keys.length === 1) {
    return { rating: null, reasons: [], comment: null };
  }
  if (keys.some((key) => !['rating', 'reasons', 'comment'].includes(key))) throw invalid();
  const { rating, reasons = [], comment = '' } = body;
  if (
    typeof rating !== 'number' ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5 ||
    !Array.isArray(reasons) ||
    reasons.length > MODEL_FEEDBACK_REASONS.length ||
    !reasons.every((reason): reason is ModelFeedbackReason =>
      MODEL_FEEDBACK_REASONS.includes(reason),
    ) ||
    new Set(reasons).size !== reasons.length ||
    (rating > 3 && reasons.length > 0) ||
    typeof comment !== 'string' ||
    comment.length > MODEL_FEEDBACK_COMMENT_MAX ||
    comment.includes('\u0000')
  )
    throw invalid();
  return { rating, reasons, comment: comment.trim() || null };
}
