import { describe, expect, it } from 'vitest';
import {
  creditsFor,
  ENLARGE_COST_USD,
  ENLARGE_MAX_SIDE,
  ENLARGE_MODEL,
  enlargeFactor,
  enlargeRequest,
  UPSCALE_CREDITS,
} from './index';

describe('the paid upscale', () => {
  it('prices one picture at what the upscaler charges plus the 70% margin', () => {
    expect(ENLARGE_COST_USD).toBe(ENLARGE_MODEL.costUsd);
    expect(UPSCALE_CREDITS).toBe(creditsFor(0.006));
    expect(UPSCALE_CREDITS).toBe(2);
  });

  it('enlarges as far as the size cap allows, and never past 4x', () => {
    expect(enlargeFactor(720)).toBe(4);
    expect(enlargeFactor(1024)).toBe(4);
    expect(enlargeFactor(1500)).toBe(2);
    expect(enlargeFactor(2000)).toBe(2);
    expect(enlargeFactor(2048)).toBe(2);
  });

  it('refuses a picture that would not even double', () => {
    expect(enlargeFactor(2049)).toBeNull();
    expect(enlargeFactor(ENLARGE_MAX_SIDE)).toBeNull();
    expect(enlargeFactor(0)).toBeNull();
  });

  it('sends only the picture: the upscaler has no scale setting', () => {
    expect(enlargeRequest('https://p/v')).toEqual({
      path: ENLARGE_MODEL.path,
      body: { input: { image: 'https://p/v' } },
    });
  });
});
