import { deflateSync } from 'node:zlib';

// A small PNG encoder, so the paid-flow test builds its photo and angle sheet without pulling in
// an image library. Pixels are RGB; `paint` returns the colour of a pixel.
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}

export type Rgb = readonly [number, number, number];

export function encodePng(
  width: number,
  height: number,
  paint: (x: number, y: number) => Rgb,
): Buffer {
  const rows = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const start = y * (1 + width * 3);
    rows[start] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = paint(x, y);
      rows[start + 1 + x * 3] = r;
      rows[start + 2 + x * 3] = g;
      rows[start + 3 + x * 3] = b;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const WHITE: Rgb = [255, 255, 255];

// A product photo: a dark mug-like block on a pale backdrop, with a gradient so the photo has the
// brightness spread and sharpness the upload guardrails ask for.
export function productPhoto(): Buffer {
  return encodePng(640, 640, (x, y) => {
    const isObject = x > 160 && x < 480 && y > 120 && y < 520;
    if (!isObject) return [235 - (y >> 5), 235 - (y >> 5), 232];
    const shade = 40 + ((x - 160) >> 1) + (((x >> 4) + (y >> 4)) % 2 ? 24 : 0);
    return [shade, Math.floor(shade * 0.6), 30];
  });
}

// A 3x3 angle sheet in the layout the harness cuts: nine different views of one block on white.
// Each cell differs in width and tint, so no two look alike (the repeated-view guardrail), while
// opposite views keep the same filled outline (the structure guardrail).
export function angleSheet(side = 1056): Buffer {
  const cell = side / 3;
  return encodePng(side, side, (x, y) => {
    const column = Math.floor(x / cell);
    const row = Math.floor(y / cell);
    const index = row * 3 + column;
    const localX = x - column * cell;
    const localY = y - row * cell;
    const half = cell * (0.16 + 0.025 * index);
    const isObject =
      Math.abs(localX - cell / 2) < half && localY > cell * 0.2 && localY < cell * 0.8;
    if (!isObject) return WHITE;
    const tone = 30 + index * 18;
    return [tone, tone + ((localX | 0) % 40), 60 + index * 12];
  });
}
