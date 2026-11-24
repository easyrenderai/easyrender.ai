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

it.each([false, true])(
  'keeps all UTMs while allowing click IDs only with permission=%s',
  (isAllowed) => {
    const utms =
      'utm_source=google&utm_medium=cpc&utm_campaign=niche&utm_content=ad&utm_term=model';
    const url = `https://easyrender.ai/es?${utms}&gclid=Ad_1&dclid=Ad_2&gbraid=Ad_3&wbraid=Ad_4&fbclid=private&email=private&token=secret#private`;
    const touch = readAdvertisingTouch(url, null, isAllowed, now);
    expect(advertisingUrl(url, touch, now)).toBe(
      `https://easyrender.ai/es?${utms}${isAllowed ? '&gclid=Ad_1&dclid=Ad_2&gbraid=Ad_3&wbraid=Ad_4' : ''}`,
    );
  },
);
