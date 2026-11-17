import { describe, expect, it } from 'vitest';
import { newRenderHref } from './new-render-href';

describe('newRenderHref', () => {
  it('sends a signed-in person back into the app, not the marketing home', () => {
    expect(newRenderHref(true)).toBe('/dashboard');
  });

  it('sends a visitor to the upload box on the home page', () => {
    expect(newRenderHref(false)).toBe('/#try');
  });
});
