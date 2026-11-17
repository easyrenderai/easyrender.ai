import sharp from 'sharp';

const SIDE = 64;
type Shape = { fill: number; aspect: number };
type StructureLimits = {
  sheetMaxOpenFill: number;
  sheetMinClosedFill: number;
  sheetMaxOppositeFillGap: number;
};

// Keep the largest connected foreground region: grid marks and isolated shadows must not
// determine the product bounds. Two thresholds below make pale/uncertain masks inconclusive.
function shape(data: Uint8Array, channels: number, threshold: number): Shape | null {
  const mask = Uint8Array.from({ length: SIDE * SIDE }, (_, i) =>
    Math.min(
      data[i * channels] ?? 255,
      data[i * channels + 1] ?? 255,
      data[i * channels + 2] ?? 255,
    ) < threshold
      ? 1
      : 0,
  );
  const seen = new Uint8Array(mask.length);
  let largest: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i]) continue;
    const queue = [i];
    seen[i] = 1;
    for (let head = 0; head < queue.length; head++) {
      const p = queue[head] as number;
      for (const next of [
        p % SIDE > 0 ? p - 1 : -1,
        p % SIDE < SIDE - 1 ? p + 1 : -1,
        p - SIDE,
        p + SIDE,
      ]) {
        if (next >= 0 && next < mask.length && mask[next] && !seen[next]) {
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
    if (queue.length > largest.length) largest = queue;
  }
  if (largest.length < 100) return null;
  const xs = largest.map((p) => p % SIDE);
  const ys = largest.map((p) => Math.floor(p / SIDE));
  const width = Math.max(...xs) - Math.min(...xs) + 1;
  const height = Math.max(...ys) - Math.min(...ys) + 1;
  if (width < 12 || height < 12) return null;
  return { fill: largest.length / (width * height), aspect: width / height };
}

function isClosedOpening(a: Shape | null, b: Shape | null, limits: StructureLimits): boolean {
  if (!a || !b) return false;
  // Opposite orthographic views should retain their outline and openings, allowing for minor
  // framing/perspective errors. This narrow rule catches a large open frame becoming solid;
  // it is not a semantic geometry check and deliberately ignores small differences.
  const aspectRatio = a.aspect / b.aspect;
  return (
    aspectRatio > 0.8 &&
    aspectRatio < 1.25 &&
    Math.min(a.fill, b.fill) < limits.sheetMaxOpenFill &&
    Math.max(a.fill, b.fill) > limits.sheetMinClosedFill &&
    Math.abs(a.fill - b.fill) > limits.sheetMaxOppositeFillGap
  );
}

export async function inconsistentOppositeViews(
  cells: Uint8Array[],
  limits: StructureLimits,
): Promise<string[]> {
  const masks = new Map<number, [Shape | null, Shape | null]>();
  for (const index of [0, 4, 2, 6]) {
    const cell = cells[index];
    if (!cell) continue;
    const { data, info } = await sharp(cell)
      .resize(SIDE, SIDE, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    masks.set(index, [shape(data, info.channels, 200), shape(data, info.channels, 225)]);
  }
  const rejected: string[] = [];
  for (const [a, b, label] of [
    [0, 4, 'front_back'],
    [2, 6, 'right_left'],
  ] as const) {
    const first = masks.get(a),
      second = masks.get(b);
    if (
      first &&
      second &&
      isClosedOpening(first[0], second[0], limits) &&
      isClosedOpening(first[1], second[1], limits)
    )
      rejected.push(label);
  }
  return rejected;
}
