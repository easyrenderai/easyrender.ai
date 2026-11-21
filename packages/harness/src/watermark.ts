import sharp from 'sharp';

// The easyrender mark (a sphere under one light), the same shapes as the site's BrandMark. It is
// drawn as paths, never as text: a server without fonts renders text as empty boxes.
const SPHERE = 'M24 7A17 17 0 0 1 24 41A6.5 17 0 0 1 24 7Z';
const MARK = `<circle cx="24" cy="24" r="17" fill="none" stroke-width="2.4"/><path d="${SPHERE}"/>`;

// One mark, centred, about half the sheet across.
const SIZE_RATIO = 0.55;
const HALO_OPACITY = 0.8;
const MARK_OPACITY = 0.45;

// The free preview is the sheet, downscaled and stamped with one large brand mark, so the unpaid
// image is never good enough to feed a 3D model elsewhere. The mark has a light halo so it reads
// on the white ground and on the object alike.
export async function watermark(image: Uint8Array): Promise<Uint8Array> {
  const resized = await sharp(image).resize(1024, 1024, { fit: 'inside' }).toBuffer();
  const { width = 1024, height = 1024 } = await sharp(resized).metadata();
  const size = Math.min(width, height) * SIZE_RATIO;
  const scale = size / 48;
  const x = (width - size) / 2;
  const y = (height - size) / 2;
  const mark = `<g transform="translate(${x} ${y}) scale(${scale}) rotate(142 24 24)">${MARK}</g>`;
  const overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<g opacity="${HALO_OPACITY}" fill="#ffffff" stroke="#ffffff" stroke-width="3.5" stroke-linejoin="round">${mark}</g>` +
      `<g opacity="${MARK_OPACITY}" fill="#18181b" stroke="#18181b">${mark}</g>` +
      `</svg>`,
  );
  const output = await sharp(resized)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .webp({ quality: 72 })
    .toBuffer();
  return new Uint8Array(output);
}

// What a visitor without an account gets in place of the sheet: small and blurred until the
// shapes are gone, so the real image only leaves the server for a signed-in owner. The blur is
// made here, never in the browser, because the browser could be asked for the original.
export async function lockedPreview(image: Uint8Array): Promise<Uint8Array> {
  const output = await sharp(image)
    .resize(480, 480, { fit: 'inside' })
    .blur(14)
    .webp({ quality: 55 })
    .toBuffer();
  return new Uint8Array(output);
}
