import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const output = join(root, 'apps/web/public/motion');
const assets = await mkdtemp(join(tmpdir(), 'easyrender-motion-'));
const require = createRequire(join(root, 'apps/web/package.json'));
await mkdir(output, { recursive: true });
await copyFile(join(root, 'apps/web/public/showcase/coffee-table.glb'), join(assets, 'table.glb'));
await copyFile(
  join(dirname(require.resolve('geist/font/sans')), 'fonts/geist-sans/Geist-Variable.woff2'),
  join(assets, 'geist.woff2'),
);
for (const [source, target] of [
  ['table.glb', 'hero-table.glb'],
  ['table.jpg', 'hero-photo.jpg'],
  ['table-angles.png', 'hero-angles.png'],
]) {
  await copyFile(join(root, 'apps/web/public/showcase', source), join(assets, target));
}
try {
  const serveUrl = await bundle({ entryPoint: join(here, 'scene.tsx'), publicDir: assets });
  for (const id of process.argv.slice(2).filter((arg) => !arg.startsWith('--')).length
    ? process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
    : ['web', 'shop', 'design']) {
    const composition = await selectComposition({ serveUrl, id, chromiumOptions: { gl: 'angle' } });
    const common = { serveUrl, composition, chromiumOptions: { gl: 'angle' } };
    await renderStill({
      ...common,
      frame: id === 'hero' ? 310 : 450,
      output: join(output, `${id}.jpg`),
      imageFormat: 'jpeg',
    });
    if (!process.argv.includes('--still'))
      await renderMedia({
        ...common,
        codec: 'h264',
        crf: 20,
        pixelFormat: 'yuv420p',
        colorSpace: 'bt709',
        concurrency: 3,
        outputLocation: join(output, `${id}.mp4`),
      });
    if (id === 'hero') {
      process.stdout.write('Rendered hero\n');
      continue;
    }
    for (const locale of ['en', 'es', 'de', 'fr', 'it', 'pt']) {
      const messages = JSON.parse(
        await readFile(join(root, `apps/web/messages/${locale}.json`), 'utf8'),
      );
      const steps = messages.Render.nextSteps[id].steps;
      const cues = [
        ['00:00.000', '00:05.000', 'download'],
        ['00:05.000', '00:12.000', 'prepare'],
        ['00:12.000', '00:18.000', 'use'],
      ];
      await writeFile(
        join(output, `${id}.${locale}.vtt`),
        `WEBVTT\n\n${cues.map(([start, end, key]) => `${start} --> ${end}\n${steps[key].title}`).join('\n\n')}\n`,
      );
    }
    process.stdout.write(`Rendered ${id}\n`);
  }
} finally {
  await rm(assets, { recursive: true, force: true });
}
