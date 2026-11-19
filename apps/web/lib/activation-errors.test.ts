import { expect, it } from 'vitest';
import { activationErrorKey } from '@/lib/activation-errors';

it('resolves mapped UI errors from stable API codes', () => {
  expect(activationErrorKey({ code: 'preview_limit', error: 'Free previews used up' })).toBe(
    'previewLimit',
  );
  expect(activationErrorKey({ code: 'photo_blank', error: 'Photo is blank' })).toBe('blank');
});

it('uses the screen fallback for unknown API failures', () => {
  expect(activationErrorKey({ code: 'toString', error: 'Internal message' })).toBeNull();
  expect(activationErrorKey({ error: 'Internal message' })).toBeNull();
});
