// No spend by default. Explicit --spend runs three builds of the existing public hero table.
// Reuses its saved sheet to isolate the 3D stage; this is not a new end-to-end sheet run.
import { createHash } from 'node:crypto';
import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assessFidelity, improveMaterials } from '../src/fidelity';
import { EXPERIMENT_TIMEOUT_MS, fidelityExperiment } from '../src/fidelity/experiment';
import { BUILD_MODEL, buildCostUsd } from '../src/models';
import {
  createReplicate,
  download,
  findGlbUrl,
  isSettled,
  type Prediction,
  toDataUri,
} from '../src/replicate';
import { cutCells } from '../src/sheet';

const arg = (name: string) =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const out = resolve(arg('out') ?? 'material-fidelity-out');
const capUsd = Number(arg('cap') ?? '2');
const isSpending = process.argv.includes('--spend');
const source = new Uint8Array(await readFile('apps/web/public/showcase/table.jpg'));
const sheet = new Uint8Array(await readFile('apps/web/public/showcase/table-angles.png'));
const cells = await cutCells(sheet);
const plans = fidelityExperiment(
  await toDataUri(source, 'image/jpeg'),
  await Promise.all(cells.map((cell) => toDataUri(cell, 'image/png'))),
  capUsd,
);
await mkdir(out, { recursive: true });
// Do not silently restart a previous paid run or overwrite prediction IDs.
const handle = await open(`${out}/plan.json`, 'wx');
await handle.writeFile(
  JSON.stringify(
    {
      isSpending,
      capUsd,
      rateUsdPerSecond: BUILD_MODEL.usdPerSecond,
      sourceSha256: createHash('sha256').update(source).digest('hex'),
      sheetSha256: createHash('sha256').update(sheet).digest('hex'),
      note: 'Existing public table photo/sheet; isolates 3D build, not the sheet generation stage. Cost is estimated, not a billing cap.',
      plans: plans.map(({ id, reservedUsd, request }) => ({
        id,
        reservedUsd,
        version: request.version,
        input: {
          ...request.input,
          images: request.input.images.map((_, index) => (index ? `view-${index - 1}` : 'source')),
        },
      })),
    },
    null,
    2,
  ),
);
await handle.close();
if (!isSpending) {
  process.stdout.write(`Dry run: ${out}/plan.json. No provider requests or spending.\n`);
  process.exit(0);
}
const token = process.env.REPLICATE_API_TOKEN ?? '';
if (!token) throw new Error('REPLICATE_API_TOKEN is required; no predictions started');
// Read-only preflight on the exact pinned version before creating any paid prediction.
const versionResponse = await fetch(
  `https://api.replicate.com/v1/models/${BUILD_MODEL.name}/versions/${BUILD_MODEL.version}`,
  {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  },
);
if (!versionResponse.ok)
  throw new Error(`Provider schema unavailable (${versionResponse.status}); nothing started`);
const schema = (await versionResponse.json()) as {
  openapi_schema?: {
    components?: {
      schemas?: { Input?: { properties?: Record<string, { minimum?: number; maximum?: number }> } };
    };
  };
};
const properties = schema.openapi_schema?.components?.schemas?.Input?.properties;
for (const { request } of plans) {
  for (const [key, value] of Object.entries(request.input)) {
    const property = properties?.[key];
    if (!property)
      throw new Error(`Pinned provider schema does not expose ${key}; nothing started`);
    if (
      typeof value === 'number' &&
      ((property.minimum !== undefined && value < property.minimum) ||
        (property.maximum !== undefined && value > property.maximum))
    )
      throw new Error(`Input ${key} is outside provider bounds; nothing started`);
  }
}
await writeFile(`${out}/source.jpg`, source);
await writeFile(`${out}/sheet.png`, sheet);
const rows: {
  id: string;
  predictionId?: string;
  status: string;
  estimatedUsd?: number;
  seconds?: number;
}[] = [];
const checkpoint = () => writeFile(`${out}/results.json`, JSON.stringify(rows, null, 2));

for (const plan of plans) {
  const row: (typeof rows)[number] = { id: plan.id, status: 'starting' };
  rows.push(row);
  await checkpoint();
  let prediction: Prediction | undefined;
  try {
    const deadline = Date.now() + EXPERIMENT_TIMEOUT_MS;
    prediction = await createReplicate(token).start('/predictions', plan.request);
    row.predictionId = prediction.id;
    row.status = prediction.status;
    await checkpoint();
    while (!isSettled(prediction.status)) {
      if (Date.now() >= deadline) throw new Error('Prediction timed out');
      await new Promise((resolve) => setTimeout(resolve, 4000));
      // Each poll gets its own bounded request window; a serverless client expires after 45s.
      prediction = await createReplicate(token).get(prediction.id);
    }
    row.status = prediction.status;
    row.seconds = prediction.metrics?.predict_time;
    row.estimatedUsd = row.seconds === undefined ? undefined : buildCostUsd(row.seconds);
    await checkpoint();
    if (prediction.status !== 'succeeded') throw new Error(`Provider ended ${prediction.status}`);
    if (row.estimatedUsd === undefined || row.estimatedUsd > plan.reservedUsd)
      throw new Error('Cost could not be reconciled within reservation; stop before another build');
    const url = findGlbUrl(prediction.output);
    if (!url) throw new Error('Provider returned no GLB');
    const raw = await download(url);
    await writeFile(`${out}/${plan.id}-raw.glb`, raw);
    const material = await improveMaterials(raw, source, 'wood table');
    await writeFile(`${out}/${plan.id}.glb`, material.bytes);
    const quality = await assessFidelity(material.bytes, source, { context: 'wood table' });
    await writeFile(`${out}/${plan.id}-qa.json`, JSON.stringify(quality.report, null, 2));
    await writeFile(`${out}/${plan.id}-qa.html`, quality.html);
    if (quality.comparison) await writeFile(`${out}/${plan.id}-qa.png`, quality.comparison);
    process.stdout.write(
      `${plan.id}: ${prediction.id}, ${row.seconds}s, estimated $${row.estimatedUsd.toFixed(3)}. Human color/texture review still required.\n`,
    );
  } catch (error) {
    // Never start a replacement or proceed to the next paid case after uncertainty/failure.
    if (prediction && !isSettled(prediction.status)) {
      try {
        const stopped = await createReplicate(token).cancel(prediction.id);
        row.status = stopped.status;
        row.seconds = stopped.metrics?.predict_time;
        row.estimatedUsd = row.seconds === undefined ? undefined : buildCostUsd(row.seconds);
      } catch {
        row.status = 'cancellation-unconfirmed';
      }
    } else if (!prediction) row.status = 'start-unconfirmed';
    await checkpoint();
    throw error;
  }
}
