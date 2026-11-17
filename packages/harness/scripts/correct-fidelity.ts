// Offline replay against an existing GLB. No provider requests, credits, or paid retries.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { correctFidelity } from '../src/fidelity';
import { normalizeObject, objectMask, photoPixels, png } from '../src/fidelity/images';
import { readRenderScene, renderView } from '../src/fidelity/renderer';

const arg = (name: string) =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const modelPath = arg('model'),
  photoPath = arg('photo'),
  outputPath = arg('out');
if (!modelPath || !photoPath || !outputPath)
  throw new Error(
    'Usage: bun packages/harness/scripts/correct-fidelity.ts --model=model.glb --photo=source.jpg --out=new-directory',
  );
const out = resolve(outputPath);
// Refuse to overwrite a previous review, including its original/corrected evidence.
await mkdir(out);
const bytes = new Uint8Array(await readFile(modelPath));
const photo = new Uint8Array(await readFile(photoPath));
const started = Date.now();
const result = await correctFidelity(bytes, photo);
await writeFile(`${out}/corrected.glb`, result.bytes, { flag: 'wx' });
await writeFile(
  `${out}/report.json`,
  JSON.stringify({ ...result.report, elapsedMs: Date.now() - started }, null, 2),
  { flag: 'wx' },
);
if (result.report.camera) {
  const source = await photoPixels(photo, 1024);
  await writeFile(
    `${out}/source.png`,
    await png(normalizeObject(source, objectMask(source), 512)),
    { flag: 'wx' },
  );
  for (const [name, model] of [
    ['before', bytes],
    ['after', result.bytes],
  ] as const) {
    const view = renderView(await readRenderScene(model, 512), result.report.camera, 512);
    await writeFile(`${out}/${name}.png`, await png(view.image), { flag: 'wx' });
  }
}
process.stdout.write(
  `${result.report.status}: ${result.report.reason}. Report: ${out}/report.json\n`,
);
