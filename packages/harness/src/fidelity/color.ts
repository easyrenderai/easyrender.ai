export type Lab = [number, number, number];
export const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const srgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
export function rgbToLab(rgb: readonly number[] | Uint8Array): Lab {
  const [r, g, b] = Array.from(rgb, (c) => linear(c / 255));
  const f = (v: number) => (v > 216 / 24389 ? Math.cbrt(v) : ((24389 / 27) * v + 16) / 116);
  const x = f((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047);
  const y = f(0.2126729 * r + 0.7151522 * g + 0.072175 * b);
  const z = f((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

// CIEDE2000, kL=kC=kH=1, D65 sRGB. Sharma's published reference pairs are in color.test.ts.
export function deltaE2000([l1, a1, b1]: Lab, [l2, a2, b2]: Lab): number {
  const rad = Math.PI / 180;
  const c1 = Math.hypot(a1, b1),
    c2 = Math.hypot(a2, b2);
  const c = (c1 + c2) / 2;
  const g = (1 - Math.sqrt(c ** 7 / (c ** 7 + 25 ** 7))) / 2;
  const ap1 = (1 + g) * a1,
    ap2 = (1 + g) * a2;
  const cp1 = Math.hypot(ap1, b1),
    cp2 = Math.hypot(ap2, b2);
  const hue = (a: number, b: number) => (Math.atan2(b, a) / rad + 360) % 360;
  const h1 = hue(ap1, b1),
    h2 = hue(ap2, b2);
  const dl = l2 - l1,
    dc = cp2 - cp1;
  let dh = h2 - h1;
  if (cp1 * cp2 === 0) dh = 0;
  else if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(cp1 * cp2) * Math.sin((dh * rad) / 2);
  const lp = (l1 + l2) / 2,
    cp = (cp1 + cp2) / 2;
  let hp = (h1 + h2) / 2;
  if (cp1 * cp2 === 0) hp = h1 + h2;
  else if (Math.abs(h1 - h2) > 180) hp += h1 + h2 < 360 ? 180 : -180;
  const t =
    1 -
    0.17 * Math.cos((hp - 30) * rad) +
    0.24 * Math.cos(2 * hp * rad) +
    0.32 * Math.cos((3 * hp + 6) * rad) -
    0.2 * Math.cos((4 * hp - 63) * rad);
  const sl = 1 + (0.015 * (lp - 50) ** 2) / Math.sqrt(20 + (lp - 50) ** 2);
  const sc = 1 + 0.045 * cp,
    sh = 1 + 0.015 * cp * t;
  const rt =
    -2 *
    Math.sqrt(cp ** 7 / (cp ** 7 + 25 ** 7)) *
    Math.sin(60 * Math.exp(-(((hp - 275) / 25) ** 2)) * rad);
  return Math.sqrt((dl / sl) ** 2 + (dc / sc) ** 2 + (dH / sh) ** 2 + rt * (dc / sc) * (dH / sh));
}
