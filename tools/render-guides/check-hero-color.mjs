import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
function sample(file, bounds, time) {
  const pixels = execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      ...(time === undefined ? [] : ['-ss', String(time)]),
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
    { maxBuffer: 1000 * 1000 * 3 + 1024 },
  );
  const [left, top, right, bottom] = bounds;
  const mean = [0, 0, 0];
  for (let y = top; y < bottom; y++)
    for (let x = left; x < right; x++)
      for (let c = 0; c < 3; c++) mean[c] += pixels[(y * 1000 + x) * 3 + c];
  return mean.map((value) => value / ((right - left) * (bottom - top)));
}

// Interior wood patches, excluding edges, background and highlights. This guards the
// baked artwork's visible color, not source settings. Layout/camera changes need new bounds.
const reference = sample(`${root}/apps/web/public/showcase/table.jpg`, [320, 453, 680, 472]);
const files = process.argv.slice(2);
if (files.length === 0)
  files.push(...['jpg', 'mp4'].map((ext) => `${root}/apps/web/public/motion/hero.${ext}`));
const samples = [];
for (const file of files) {
  const actual = sample(file, [400, 245, 580, 290], file.endsWith('.mp4') ? 310 / 30 : undefined);
  const error = Math.max(...actual.map((value, c) => Math.abs(value - reference[c])));
  samples.push(actual);
  // Allow lighting/viewpoint differences, but reject the previous >25/255 channel shift.
  assert.ok(error <= 20, `Wood color differs by ${error.toFixed(1)}/255: ${file}`);
  process.stdout.write(`${file}: wood color within tolerance (${error.toFixed(1)}/255)\n`);
}
if (process.argv.length === 2) {
  const difference = Math.max(...samples[0].map((value, c) => Math.abs(value - samples[1][c])));
  assert.ok(difference <= 3, `Poster/video lighting differs by ${difference.toFixed(1)}/255`);
  process.stdout.write(
    `Poster/video match within compression tolerance (${difference.toFixed(1)}/255)\n`,
  );
}
