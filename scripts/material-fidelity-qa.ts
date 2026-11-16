// Read-only by default. Reports stay in the ignored evidence directory.
// bun scripts/material-fidelity-qa.ts --showcase
// bun scripts/material-fidelity-qa.ts --model model.glb --photo photo.jpg --hint 'brushed steel' [--azimuth 30] [--repair]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { assessFidelity, improveMaterials } from '@easyrender/harness/fidelity';

const args = process.argv.slice(2);
const value = (flag: string) => {
  const i = args.indexOf(flag);
  return i < 0 ? undefined : args[i + 1];
};
const out = resolve(value('--out') ?? '.data/pipeline-fidelity-evidence');
const publicRoot = resolve('apps/web/public');
// Reviewed source-photo descriptions, not hard-coded detection by product id. Camera angles
// reproduce the showcase comparisons from PR #143; armchair uses the same studio convention.
const showcase = [
  ['armchair', 'ochre fabric with brushed steel legs', undefined],
  ['barrel', 'weathered painted metal', 210],
  ['bedside-table', 'walnut wood', -60],
  ['cactus', 'green cactus in ceramic pot', 210],
  ['clay-vase', 'clay ceramic vase', 210],
  ['coffee-table', 'oak wood table', 210],
  ['crate', 'wood crate with iron corners', 210],
  ['espresso', 'brushed stainless steel with black plastic grips', 30],
  ['lamp', 'brushed champagne brass lamp', 210],
  ['sneaker', 'leather sneaker with rubber sole', 300],
  ['sofa', 'charcoal fabric sofa', 30],
  ['swivel-chair', 'grey fabric with glossy black plastic base', 300],
  ['vase', 'sandy stone ceramic vase', 210],
] as const;
const jobs = args.includes('--gallery')
  ? showcase
      .filter(([id]) =>
        ['armchair', 'clay-vase', 'coffee-table', 'bedside-table', 'vase', 'swivel-chair'].includes(
          id,
        ),
      )
      .map(([id, hint, azimuth]) => ({
        id,
        hint,
        azimuth,
        model: join(publicRoot, 'showcase', `${id}.glb`),
        photo: join(publicRoot, 'showcase', `${id}.jpg`),
      }))
  : args.includes('--showcase')
    ? showcase.map(([id, hint, azimuth]) => ({
        id,
        hint,
        azimuth,
        model: join(publicRoot, 'studio/models', `${id}.glb`),
        photo: join(publicRoot, 'studio/photos', `${id}.jpg`),
      }))
    : [
        {
          id: basename(value('--model') ?? 'piece.glb', '.glb'),
          model: value('--model'),
          photo: value('--photo'),
          hint: value('--hint') ?? '',
          azimuth: value('--azimuth') === undefined ? undefined : Number(value('--azimuth')),
        },
      ];
if (
  jobs.some(
    (job) =>
      !job.model || !job.photo || (job.azimuth !== undefined && !Number.isFinite(job.azimuth)),
  )
)
  throw new Error(
    'Use --showcase or --model model.glb --photo photo.jpg [--hint material] [--azimuth degrees] [--repair]',
  );
await mkdir(out, { recursive: true });
const summary = [];
for (const job of jobs) {
  const dir = join(out, job.id);
  await mkdir(dir, { recursive: true });
  const original = await readFile(job.model as string);
  const photo = await readFile(job.photo as string);
  let model: Uint8Array = original;
  if (args.includes('--repair')) {
    const pass = await improveMaterials(original, photo, job.hint);
    model = pass.bytes;
    await writeFile(join(dir, 'repaired.glb'), model);
    await writeFile(
      join(dir, 'material-pass.json'),
      JSON.stringify({ ...pass, bytes: undefined }, null, 2),
    );
  }
  const result = await assessFidelity(model, photo, { context: job.hint, azimuth: job.azimuth });
  await writeFile(join(dir, 'report.json'), JSON.stringify(result.report, null, 2));
  await writeFile(join(dir, 'report.html'), result.html);
  if (result.comparison) await writeFile(join(dir, 'comparison.png'), result.comparison);
  const row = { id: job.id, ...result.report };
  summary.push(row);
  process.stdout.write(
    `${job.id}: ${result.report.isFlagged ? 'FLAG' : 'OK'} ΔE=${result.report.color?.meanDeltaE.toFixed(2) ?? 'unavailable'} ${result.report.warnings.join(', ')}\n`,
  );
}
await writeFile(join(out, 'summary.json'), JSON.stringify(summary, null, 2));
