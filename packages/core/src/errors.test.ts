import { describe, expect, it } from 'vitest';
import { AppError, isRetryable } from './errors';

describe('isRetryable', () => {
  it.each([
    [429, 'rate_limit', true],
    [429, 'preview_limit', true],
    [429, 'concurrent_limit', true],
    [502, 'upstream', true],
    [503, 'upstream_unavailable', true],
    [503, 'exports_unavailable', true],
    [504, 'upstream_timeout', true],
    [400, 'bad_request', false],
    [401, 'unauthorized', false],
    [402, 'insufficient_credits', false],
    [403, 'forbidden', false],
    [404, 'not_found', false],
    [409, 'conflict', false],
    [500, 'internal', false],
  ])('answers %i %s with %s', (status, code, expected) => {
    expect(isRetryable(new AppError('x', status, code))).toBe(expected);
  });

  it('is false for anything that is not an AppError', () => {
    expect(isRetryable(new Error('boom'))).toBe(false);
    expect(isRetryable({ status: 502 })).toBe(false);
    expect(isRetryable(undefined)).toBe(false);
  });
});
