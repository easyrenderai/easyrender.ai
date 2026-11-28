import { describe, expect, it } from 'vitest';
import { parseModelFeedback } from './model-feedback-input';

describe('model feedback validation', () => {
  it('accepts each whole rating and optional details, trimming the comment', () => {
    for (const rating of [1, 2, 3, 4, 5]) {
      expect(parseModelFeedback({ rating })).toEqual({ rating, reasons: [], comment: null });
    }
    expect(
      parseModelFeedback({ rating: 2, reasons: ['shape', 'texture'], comment: '  rough  ' }),
    ).toEqual({ rating: 2, reasons: ['shape', 'texture'], comment: 'rough' });
    expect(parseModelFeedback({ dismissed: true })).toEqual({
      rating: null,
      reasons: [],
      comment: null,
    });
  });

  it.each([
    null,
    [],
    'bad',
    {},
    { rating: 0 },
    { rating: 6 },
    { rating: 1.5 },
    { rating: '3' },
    { rating: 3, reasons: 'shape' },
    { rating: 3, reasons: ['unknown'] },
    { rating: 3, reasons: ['shape', 'shape'] },
    { rating: 4, reasons: ['shape'] },
    { rating: 3, comment: 5 },
    { rating: 3, comment: 'bad\u0000text' },
    { rating: 3, comment: 'a'.repeat(1001) },
    { rating: 3, comment: ' '.repeat(1001) },
    { rating: 3, userId: 'other' },
    { dismissed: false },
    { dismissed: true, rating: 3 },
    { dismissed: true, comment: 'text' },
  ])('rejects malformed or ambiguous input %# without echoing it', (input) => {
    expect(() => parseModelFeedback(input)).toThrowError('Invalid model feedback');
  });
});
