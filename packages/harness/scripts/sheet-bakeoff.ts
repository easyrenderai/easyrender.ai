// Sheet bake-off: draws the angle sheet of each showcase photo with each candidate model, runs the
// production sheet guardrails on it and (optionally) builds the 3D model from it with the production
// TRELLIS settings, so the models can be compared on what the pipeline actually does with them.
//
// Usage: REPLICATE_API_TOKEN=... bun packages/harness/scripts/sheet-bakeoff.ts --spend [--build]
//          [--candidates=lite-1k,nb2-2k] [--photos=armchair,vase] [--out=bakeoff-out]
//
// It spends money on Replicate, so it refuses to run without --spend. It writes every sheet and
// model, results.json, summary.md and a strip per photo (photo, then each candidate's sheet).
// Shape and material are judged by a person looking at the strips; the script only reports what
// code can check: guardrails, size, time and cost.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp, { type OverlayOptions } from 'sharp';
import {
  buildCostUsd,
  buildRequest,
  checkGlb,
  checkSheet,
  createReplicate,
  cutCells,
  DEFAULT_BUILD_SETTINGS,
  findGlbUrl,
  isSettled,
  LIMITS,
  type Prediction,
  type ReplicateClient,
  sheetOutputUrl,
  sheetPrompt,
} from '../src/index.ts';

type Candidate = {
  id: string;
  model: string;
  // Listed Replicate price per image (secondary sources, 2026-11); the run records the real one.
  costUsd: number;
  input: Record<string, unknown>;
  imageKey: string;
};

const SQUARE = { aspect_ratio: '1:1', output_format: 'png' };
const CANDIDATES: Candidate[] = [
  {
    id: 'pro-2k',
    model: 'google/nano-banana-pro',
    costUsd: 0.15,
    input: { ...SQUARE, resolution: '2K' },
    imageKey: 'image_input',
  },
  {
    id: 'nb2-2k',
    model: 'google/nano-banana-2',
    costUsd: 0.101,
    input: { ...SQUARE, resolution: '2K' },
    imageKey: 'image_input',
  },
  {
    id: 'nb2-1k',
    model: 'google/nano-banana-2',
    costUsd: 0.067,
    input: { ...SQUARE, resolution: '1K' },
    imageKey: 'image_input',
  },
  {
    id: 'nb21-2k',
    model: 'google/nano-banana-2.1',
    costUsd: 0.0504,
    input: { ...SQUARE, resolution: '2K' },
    imageKey: 'image_input',
  },
  {
    id: 'nb21-1k',
    model: 'google/nano-banana-2.1',
    costUsd: 0.0336,
    input: { ...SQUARE, resolution: '1K' },
    imageKey: 'image_input',
  },
  {
    id: 'lite-1k',
    model: 'google/nano-banana-2-lite',
    costUsd: 0.034,
    input: { ...SQUARE },
    imageKey: 'image_input',
  },
  {
    id: 'gpt26-flare',
    model: 'openai/gpt-image-2.6-flare',
    // Billed per token; this is a guess for a 1K image at medium quality, not a listed price.
    costUsd: 0.047,
    input: { ...SQUARE, quality: 'medium' },
    imageKey: 'input_images',
  },
  {
    id: 'gpt26-sunburst',
    model: 'openai/gpt-image-2.6-sunburst',
    costUsd: 0.047,
    input: { ...SQUARE, quality: 'medium' },
    imageKey: 'input_images',
  },
  {
    id: 'gpt-low',
    model: 'openai/gpt-image-2',
    costUsd: 0.012,
    input: { ...SQUARE, quality: 'low' },
    imageKey: 'input_images',
  },
  {
    id: 'gpt-medium',
    model: 'openai/gpt-image-2',
    costUsd: 0.047,
    input: { ...SQUARE, quality: 'medium' },
    imageKey: 'input_images',
  },
  {
    id: 'gpt-high',
    model: 'openai/gpt-image-2',
    costUsd: 0.128,
    input: { ...SQUARE, quality: 'high' },
    imageKey: 'input_images',
  },
];

const PHOTOS = [
  'armchair',
  'bedside-table',
  'clay-vase',
  'coffee-table',
  'swivel-chair',
  'vase',
] as const;

const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const list = (value: string | undefined) => value?.split(',').filter(Boolean);

if (!process.argv.includes('--spend')) {
  console.error('This spends money on Replicate. Run again with --spend.');
  process.exit(1);
}
const token = process.env.REPLICATE_API_TOKEN ?? '';
const out = arg('out') ?? 'bakeoff-out';
const wantBuild = process.argv.includes('--build');
const wantedCandidates = list(arg('candidates'));
const wantedPhotos = list(arg('photos'));
const candidates = CANDIDATES.filter((c) => !wantedCandidates || wantedCandidates.includes(c.id));
const photos = PHOTOS.filter((p) => !wantedPhotos || wantedPhotos.includes(p));
if (candidates.length === 0 || photos.length === 0) throw new Error('Nothing selected to run.');

const client: ReplicateClient = createReplicate(token);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The inputs a model really takes, read from its published schema, so a wrong key name is dropped
// and logged instead of failing the whole run. Returns null when the schema cannot be read.
async function schemaInputs(model: string): Promise<Set<string> | null> {
  const response = await fetch(`https://api.replicate.com/v1/models/${model}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    latest_version?: {
      openapi_schema?: { components?: { schemas?: { Input?: { properties?: object } } } };
    };
  };
  const properties = body.latest_version?.openapi_schema?.components?.schemas?.Input?.properties;
  return properties ? new Set(Object.keys(properties)) : null;
}

async function settle(first: Prediction, limitMs: number): Promise<Prediction> {
  let prediction = first;
  const deadline = Date.now() + limitMs;
  while (!isSettled(prediction.status)) {
    if (Date.now() > deadline) throw new Error(`prediction ${prediction.id} timed out`);
    await sleep(4000);
    prediction = await client.get(prediction.id);
  }
  return prediction;
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

type Row = {
  photo: string;
  candidate: string;
  sheet: {
    ok: boolean;
    note: string;
    width?: number;
    height?: number;
    seconds?: number;
    costUsd: number;
    warnings?: string[];
  };
  build?: { ok: boolean; note: string; glbBytes?: number; seconds?: number; costUsd?: number };
};

async function runOne(photo: string, candidate: Candidate, accepted: Set<string> | null) {
  const dir = `${out}/${photo}`;
  mkdirSync(dir, { recursive: true });
  const row: Row = {
    photo,
    candidate: candidate.id,
    sheet: { ok: false, note: '', costUsd: candidate.costUsd },
  };
  try {
    const source = new Uint8Array(readFileSync(`apps/web/public/showcase/${photo}.jpg`));
    const sourceUrl = await client.upload(source, `${photo}.jpg`, 'image/jpeg');
    const input: Record<string, unknown> = {
      ...candidate.input,
      prompt: sheetPrompt(null),
      [candidate.imageKey]: [sourceUrl],
    };
    for (const key of Object.keys(input)) {
      if (accepted && !accepted.has(key)) {
        console.warn(`${candidate.model}: input "${key}" is not in its schema, dropped`);
        delete input[key];
      }
    }
    const started = await client.start(`/models/${candidate.model}/predictions`, { input });
    const done = await settle(started, 10 * 60_000);
    row.sheet.seconds = done.metrics?.predict_time;
    const url = done.status === 'succeeded' ? sheetOutputUrl(done.output) : null;
    if (!url) throw new Error(done.error ?? `sheet ${done.status}`);
    const sheet = await fetchBytes(url);
    writeFileSync(`${dir}/${candidate.id}.png`, sheet);
    const meta = await sharp(sheet).metadata();
    row.sheet.width = meta.width;
    row.sheet.height = meta.height;
    const check = await checkSheet(sheet, LIMITS);
    row.sheet.ok = check.ok;
    row.sheet.note = check.ok ? 'passes the guardrails' : `${check.code}: ${check.message}`;
    if (check.ok) row.sheet.warnings = check.warnings;
    if (!check.ok || !wantBuild) return row;

    row.build = { ok: false, note: '' };
    const images = [await client.upload(source, `${photo}.jpg`, 'image/jpeg')];
    for (const [index, cell] of (await cutCells(sheet)).entries()) {
      images.push(await client.upload(cell, `view-${index}.png`, 'image/png'));
    }
    const build = await settle(
      await client.start('/predictions', buildRequest(images, DEFAULT_BUILD_SETTINGS)),
      15 * 60_000,
    );
    row.build.seconds = build.metrics?.predict_time;
    row.build.costUsd = buildCostUsd(build.metrics?.predict_time);
    const glbUrl = build.status === 'succeeded' ? findGlbUrl(build.output) : null;
    if (!glbUrl) throw new Error(build.error ?? `build ${build.status}`);
    const glb = await fetchBytes(glbUrl);
    writeFileSync(`${dir}/${candidate.id}.glb`, glb);
    const glbCheck = checkGlb(glb);
    row.build.glbBytes = glb.byteLength;
    row.build.ok = glbCheck.ok;
    row.build.note = glbCheck.ok ? 'valid GLB' : `${glbCheck.code}: ${glbCheck.message}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (row.build) row.build.note = message;
    else row.sheet.note = message;
  }
  return row;
}

// One strip per photo: the photo, then each candidate's sheet at the same size, labelled.
async function strip(photo: string, ids: string[]) {
  const size = 360;
  const tiles: OverlayOptions[] = [];
  const names = ['photo', ...ids];
  const files = [
    `apps/web/public/showcase/${photo}.jpg`,
    ...ids.map((id) => `${out}/${photo}/${id}.png`),
  ];
  let x = 0;
  for (const [index, file] of files.entries()) {
    try {
      const tile = await sharp(file)
        .resize(size, size, { fit: 'contain', background: '#fff' })
        .png()
        .toBuffer();
      tiles.push({ input: tile, left: x, top: 28 });
      const label = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="28"><text x="8" y="20" font-size="16" font-family="sans-serif">${names[index]}</text></svg>`,
      );
      tiles.push({ input: label, left: x, top: 0 });
    } catch {
      // A candidate that produced no sheet leaves a blank tile.
    }
    x += size;
  }
  await sharp({
    create: { width: size * files.length, height: size + 28, channels: 3, background: '#fff' },
  })
    .composite(tiles)
    .png()
    .toFile(`${out}/${photo}/strip.png`);
}

// A bad token fails here, before any prediction is paid for, instead of 42 times in the table.
const account = await fetch('https://api.replicate.com/v1/account', {
  headers: { Authorization: `Bearer ${token}` },
});
if (!account.ok) {
  console.error(`Replicate refused the token (${account.status}). Nothing was run or spent.`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
const schemas = new Map<string, Set<string> | null>();
for (const model of new Set(candidates.map((c) => c.model))) {
  schemas.set(model, await schemaInputs(model));
}

const jobs = photos.flatMap((photo) => candidates.map((candidate) => ({ photo, candidate })));
const rows: Row[] = [];
const WORKERS = 3;
let next = 0;
await Promise.all(
  Array.from({ length: WORKERS }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      if (!job) return;
      const row = await runOne(job.photo, job.candidate, schemas.get(job.candidate.model) ?? null);
      rows.push(row);
      console.log(
        `${row.photo} / ${row.candidate}: ${row.sheet.note}${row.build ? ` | build: ${row.build.note}` : ''}`,
      );
    }
  }),
);

for (const photo of photos)
  await strip(
    photo,
    candidates.map((c) => c.id),
  );

rows.sort((a, b) => a.photo.localeCompare(b.photo) || a.candidate.localeCompare(b.candidate));
writeFileSync(`${out}/results.json`, `${JSON.stringify(rows, null, 2)}\n`);

const usd = (value: number | undefined) => (value === undefined ? '-' : `$${value.toFixed(3)}`);
const lines = [
  '| photo | candidate | sheet | size | sheet $ | build | build $ |',
  '|---|---|---|---|---|---|---|',
  ...rows.map(
    (r) =>
      `| ${r.photo} | ${r.candidate} | ${r.sheet.ok ? 'ok' : 'FAIL'} ${r.sheet.note.replace(/\|/g, '/')} | ${r.sheet.width ?? '-'}x${r.sheet.height ?? '-'} | ${usd(r.sheet.costUsd)} | ${r.build ? (r.build.ok ? 'ok' : `FAIL ${r.build.note.replace(/\|/g, '/')}`) : '-'} | ${usd(r.build?.costUsd)} |`,
  ),
];
const perCandidate = candidates.map((c) => {
  const mine = rows.filter((r) => r.candidate === c.id);
  const passed = mine.filter((r) => r.sheet.ok).length;
  return `| ${c.id} | ${c.model} | ${passed}/${mine.length} | ${usd(c.costUsd)} |`;
});
const summary = [
  '# Sheet bake-off',
  '',
  'Guardrail pass rate (listed price per image is from secondary sources, not measured):',
  '',
  '| candidate | model | sheets passing guardrails | listed $ per sheet |',
  '|---|---|---|---|',
  ...perCandidate,
  '',
  'Every run:',
  '',
  ...lines,
  '',
  'Shape and material are judged by eye on each photo strip.png: the guardrails only catch broken sheets.',
  '',
].join('\n');
writeFileSync(`${out}/summary.md`, summary);
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY)
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, summary, { flag: 'a' });

// A run where no sheet came back is a failed run, not a green one.
if (!rows.some((row) => row.sheet.ok)) {
  console.error('No candidate produced a usable sheet.');
  process.exit(1);
}
