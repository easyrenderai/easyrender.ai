import { describe, expect, it } from 'vitest';
import { detectArDevice } from './ar-device';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

describe('detectArDevice', () => {
  it('shows the QR code on computers', () => {
    expect(detectArDevice({ userAgent: MAC, maxTouchPoints: 0 }, false)).toBe('desktop');
    expect(detectArDevice({ userAgent: WINDOWS, maxTouchPoints: 10 }, false)).toBe('desktop');
  });

  it('shows the AR button on an iPhone and an Android phone', () => {
    expect(detectArDevice({ userAgent: IPHONE, maxTouchPoints: 5 }, true)).toBe('phone');
    expect(detectArDevice({ userAgent: ANDROID, maxTouchPoints: 5 }, false)).toBe('phone');
  });

  it('treats an iPad that asks for the desktop site as a phone', () => {
    expect(detectArDevice({ userAgent: MAC, maxTouchPoints: 5 }, true)).toBe('phone');
  });

  it('flags an iPhone browser that cannot open Quick Look', () => {
    expect(detectArDevice({ userAgent: IPHONE, maxTouchPoints: 5 }, false)).toBe('ios-no-ar');
  });
});
