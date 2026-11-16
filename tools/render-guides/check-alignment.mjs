import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Test the delivered pixels, not the layout constants: a centred JSX box can still produce
// an old or misplaced baked video. Requires ffmpeg on PATH, like the manual frame review.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const files = process.argv.slice(2);
if (files.length === 0) {
  files.push(...['web', 'shop', 'design'].map((id) => `${root}/apps/web/public/motion/${id}.mp4`));
}
for (const file of files) {
  const width = 1200;
  const height = 900;
  const pixels = execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-ss',
      '3',
      '-i',
      file,
      '-frames:v',
      '1',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      'pipe:1',
    ],
    { maxBuffer: width * height * 3 + 1024 },
  );
  assert.equal(pixels.length, width * height * 3, 'Unexpected video frame dimensions');
  // The light download control is isolated in the lower-middle band at this held frame.
  let left = width;
  let right = -1;
  for (let y = 625; y < 700; y++) {
    for (let x = 400; x < 800; x++) {
      const offset = (y * width + x) * 3;
      if (pixels[offset] > 190 && pixels[offset + 1] > 190 && pixels[offset + 2] > 190) {
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
  }
  assert.ok(right - left > 100, 'Download button not visible in the expected scene');
  const offset = (left + right) / 2 - width / 2;
  assert.ok(Math.abs(offset) <= 2, `Download button is off-centre by ${offset}px: ${file}`);
  process.stdout.write(`${file}: centred (offset ${offset}px)\n`);
}
