import { describe, expect, it } from 'vitest';
import { KEY_SCOPES, parseKeyRestrictions } from './api-key-form';

const now = new Date('2030-01-01T12:00').getTime();
const defaults = { scopes: [...KEY_SCOPES], creditLimit: '', expiresAt: '' };

describe('API key creation controls', () => {
  it('preserves full access, unlimited spend and no expiry when fields are left alone', () => {
    expect(parseKeyRestrictions(defaults, now)).toEqual({
      value: {
        scopes: ['read', 'write', 'spend', 'share'],
        creditLimit: null,
        expiresAt: null,
      },
    });
  });
  it('preserves a zero cap and converts local expiry to an unambiguous ISO date', () => {
    expect(
      parseKeyRestrictions(
        { scopes: ['read'], creditLimit: '0', expiresAt: '2030-01-02T12:30' },
        now,
      ),
    ).toEqual({
      value: {
        scopes: ['read'],
        creditLimit: 0,
        expiresAt: new Date('2030-01-02T12:30').toISOString(),
      },
    });
  });
  it('refuses empty permissions, fractions, negative and overflowing credit caps', () => {
    expect(parseKeyRestrictions({ ...defaults, scopes: [] }, now)).toEqual({ error: 'scopes' });
    for (const creditLimit of ['-1', '2.5', '2147483648', 'Infinity', 'not a number']) {
      expect(parseKeyRestrictions({ ...defaults, creditLimit }, now)).toEqual({
        error: 'creditLimit',
      });
    }
  });
  it('refuses past, invalid or normalized-away calendar dates', () => {
    for (const expiresAt of [
      '2029-12-31T12:00',
      'tomorrow',
      '2030-02-31T12:00',
      '2030-01-01T12:00',
    ]) {
      expect(parseKeyRestrictions({ ...defaults, expiresAt }, now)).toEqual({ error: 'expiresAt' });
    }
  });
});
