import { describe, expect, it } from 'vitest';
import { advertisingUrl, readAdvertisingTouch } from './advertising';

const now = 1_800_000_000_000;
describe('explicit advertising attribution', () => {
  it('keeps only bounded click IDs after explicit permission, without unrelated URL data', () => {
    const touch = readAdvertisingTouch(
      'https://easyrender.ai/mcp?gclid=Ab_12-3&email=private&token=secret#private',
      null,
      true,
      now,
    );
    expect(touch).toEqual({ ids: { gclid: 'Ab_12-3' }, expiresAt: now + 30 * 60 * 1000 });
    expect(advertisingUrl('https://easyrender.ai/es/mcp?email=private#secret', touch, now)).toBe(
      'https://easyrender.ai/es/mcp?gclid=Ab_12-3',
    );
    expect(
      readAdvertisingTouch('https://easyrender.ai/?gclid=private', null, false, now),
    ).toBeNull();
    expect(advertisingUrl('https://easyrender.ai/?gclid=private', null, now)).toBe(
      'https://easyrender.ai/',
    );
  });
  it('does not extend retention across pages and refuses expired or invalid saved attribution', () => {
    const saved = { ids: { gclid: 'known' }, expiresAt: now + 1000 };
    expect(readAdvertisingTouch('https://easyrender.ai/next', saved, true, now)).toEqual(saved);
    expect(readAdvertisingTouch('https://easyrender.ai/next', saved, true, now + 1001)).toBeNull();
    expect(advertisingUrl('https://easyrender.ai/', saved, now + 1001)).toBe(
      'https://easyrender.ai/',
    );
    expect(
      readAdvertisingTouch(
        'https://easyrender.ai/',
        { ...saved, expiresAt: now + 31 * 60 * 1000 },
        true,
        now,
      ),
    ).toBeNull();
    expect(
      readAdvertisingTouch(`https://easyrender.ai/?gclid=${'x'.repeat(513)}`, null, true, now),
    ).toBeNull();
    expect(
      readAdvertisingTouch('https://easyrender.ai/?gclid=private%40example.com', null, true, now),
    ).toBeNull();
  });
  it('never restores saved IDs after advertising permission has been withdrawn', () => {
    expect(
      readAdvertisingTouch(
        'https://easyrender.ai/',
        { ids: { gclid: 'known' }, expiresAt: now + 1000 },
        false,
        now,
      ),
    ).toBeNull();
  });
});
