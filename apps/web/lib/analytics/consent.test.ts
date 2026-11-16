import { expect, it } from 'vitest';
import { readConsent } from './consent';

const now = Date.now();
const cookie = (value: Record<string, unknown>) =>
  encodeURIComponent(
    JSON.stringify({ version: 'v1', date: new Date(now).toISOString(), ...value }),
  );
it('preserves legacy analytics-only acceptance and refuses stale or malformed consent', () => {
  expect(readConsent(cookie({ accepted: true }), now)).toEqual({
    accepted: true,
    advertising: false,
  });
  expect(readConsent(cookie({ accepted: true, advertising: true }), now)).toEqual({
    accepted: true,
    advertising: true,
  });
  expect(readConsent(cookie({ accepted: false, advertising: true }), now)).toEqual({
    accepted: false,
    advertising: false,
  });
  for (const raw of [
    'garbage',
    cookie({ accepted: true, advertising: 'yes' }),
    cookie({ accepted: true, date: new Date(now - 367 * 86400000).toISOString() }),
    cookie({ accepted: true, date: new Date(now + 1000).toISOString() }),
  ])
    expect(readConsent(raw, now).advertising).toBe(false);
});
