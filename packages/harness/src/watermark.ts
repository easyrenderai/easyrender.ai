import sharp from 'sharp';

// The easyrender mark (a sphere under one light), the same shapes as the site's BrandMark. It is
// drawn as paths, never as text: a server without fonts renders text as empty boxes.
const SPHERE = 'M24 7A17 17 0 0 1 24 41A6.5 17 0 0 1 24 7Z';
const MARK = `<circle cx="24" cy="24" r="17" fill="none" stroke-width="2.4"/><path d="${SPHERE}"/>`;

const SIZE = 60;
const STEP_X = 170;
const STEP_Y = 130;

// The free preview is the sheet, downscaled and tiled with the brand mark, so the unpaid image is
// never good enough to feed a 3D model elsewhere. Each mark has a light halo so it reads on the
// white ground and on the object alike.
export async function watermark(image: Uint8Array): Promise<Uint8Array> {
  const resized = await sharp(image).resize(1024, 1024, { fit: 'inside' }).toBuffer();
  const { width = 1024, height = 1024 } = await sharp(resized).metadata();
  const scale = SIZE / 48;
  const marks: string[] = [];
  for (let row = 0; row * STEP_Y - SIZE < height; row++) {
    for (let col = 0; (col - 1) * STEP_X < width; col++) {
      const x = col * STEP_X + (row % 2) * (STEP_X / 2) - SIZE / 2;
      const y = row * STEP_Y + STEP_Y / 3 - SIZE / 2;
      marks.push(
        `<g transform="translate(${x} ${y}) scale(${scale}) rotate(142 24 24)">${MARK}</g>`,
      );
    }
  }
  const overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<g fill="none" stroke="none" opacity="0.55" stroke-linejoin="round">` +
      `<g fill="#ffffff" stroke="#ffffff" stroke-width="4">${marks.join('')}</g></g>` +
      `<g opacity="0.3" fill="#18181b" stroke="#18181b">${marks.join('')}</g>` +
      `</svg>`,
  );
  const output = await sharp(resized)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .webp({ quality: 72 })
    .toBuffer();
  return new Uint8Array(output);
}
