import { expect, it } from 'vitest';
import { correctionNote } from './sheet-correction';

it('retains multiple selected corrections and the specific user instruction', () => {
  expect(correctionNote(['Correct the shape.', 'Keep all parts.'], '  Keep the open base. ')).toBe(
    'Correct the shape.\nKeep all parts.\nKeep the open base.',
  );
});
it('allows a custom correction without any category', () => {
  expect(correctionNote([], 'Make the back match the photo.')).toBe(
    'Make the back match the photo.',
  );
});
it('does not turn empty input into a paid correction', () => {
  expect(correctionNote([], '  ')).toBe('');
});
