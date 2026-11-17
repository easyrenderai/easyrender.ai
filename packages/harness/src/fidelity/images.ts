import sharp from 'sharp';

export type Pixels = { data: Uint8Array; width: number; height: number };
export async function pixels(bytes: Uint8Array, size = 256, height = size): Promise<Pixels> {
  const { data, info } = await sharp(bytes, { limitInputPixels: 25_000_000 })
    .rotate()
    .resize(size, height, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
export async function photoPixels(bytes: Uint8Array, size = 256): Promise<Pixels> {
  const { data, info } = await sharp(bytes, { limitInputPixels: 25_000_000 })
    .rotate()
    .resize(size, size, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
export const png = (image: Pixels) =>
  sharp(image.data, { raw: { width: image.width, height: image.height, channels: 4 } })
    .png()
    .toBuffer();

// A conservative background estimate: remove only border-connected pixels near the corner
// colour. It cannot distinguish a pale object from a pale background; QA reports low coverage.
export function objectMask(image: Pixels): Uint8Array {
  const { data, width, height } = image;
  const mask = new Uint8Array(width * height).fill(1);
  const corners = [0, width - 1, width * (height - 1), width * height - 1];
  const bg = [0, 1, 2].map((c) => corners.reduce((sum, p) => sum + data[p * 4 + c], 0) / 4);
  const queue: number[] = [];
  const visit = (p: number) => {
    if (!mask[p]) return;
    const delta = Math.hypot(...bg.map((c, i) => data[p * 4 + i] - c));
    if (data[p * 4 + 3] < 128 || delta < 24) {
      mask[p] = 0;
      queue.push(p);
    }
  };
  for (let x = 0; x < width; x++) {
    visit(x);
    visit((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    visit(y * width);
    visit(y * width + width - 1);
  }
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (p % width) visit(p - 1);
    if (p % width < width - 1) visit(p + 1);
    if (p >= width) visit(p - width);
    if (p < width * (height - 1)) visit(p + width);
  }
  return mask;
}

export function statistics(values: number[]) {
  const mean = values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
  const std = Math.sqrt(
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / Math.max(1, values.length),
  );
  return {
    mean,
    std,
    min: values.length ? values.reduce((a, b) => Math.min(a, b), Infinity) : 0,
    max: values.length ? values.reduce((a, b) => Math.max(a, b), -Infinity) : 0,
  };
}

export function normalizeObject(image: Pixels, mask: Uint8Array, size = 192): Pixels {
  let left = image.width,
    right = 0,
    top = image.height,
    bottom = 0;
  for (let p = 0; p < mask.length; p++)
    if (mask[p]) {
      left = Math.min(left, p % image.width);
      right = Math.max(right, p % image.width);
      top = Math.min(top, Math.floor(p / image.width));
      bottom = Math.max(bottom, Math.floor(p / image.width));
    }
  if (left > right || top > bottom) throw new Error('No object mask');
  const scale = (size - 12) / Math.max(right - left + 1, bottom - top + 1);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const sx = Math.round((x - size / 2) / scale + (left + right) / 2);
      const sy = Math.round((y - size / 2) / scale + (top + bottom) / 2);
      if (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height) continue;
      const p = sy * image.width + sx;
      if (mask[p]) data.set(image.data.subarray(p * 4, p * 4 + 4), (y * size + x) * 4);
    }
  return { data, width: size, height: size };
}

export function overlap(a: Pixels, b: Pixels) {
  let intersection = 0,
    union = 0;
  for (let i = 3; i < a.data.length; i += 4) {
    const hasA = a.data[i] > 127,
      hasB = b.data[i] > 127;
    if (hasA && hasB) intersection++;
    if (hasA || hasB) union++;
  }
  return intersection / Math.max(1, union);
}
