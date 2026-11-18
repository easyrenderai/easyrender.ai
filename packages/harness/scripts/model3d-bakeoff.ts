// 3D model bake-off: builds the showcase photos with each candidate image-to-3D model on Replicate
// and checks the GLB with the production check, so the models can be compared on cost, time and
// what comes back. TRELLIS v1 (production) gets the photo alone here too, for a like-for-like pair
// with the single-image candidates. Shape and texture are judged by a person looking at the GLBs.
//
// Usage: REPLICATE_API_TOKEN=... bun packages/harness/scripts/model3d-bakeoff.ts --spend
//          [--candidates=trellis1,hunyuan31,trellis2,t2-low,t2-mid,t2-high] [--photos=armchair,swivel-chair] [--out=model3d-out]
//
// It spends money on Replicate, so it refuses to run without --spend.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  A100_USD_PER_SECOND,
  BUILD_MODEL,
  checkGlb,
  createReplicate,
  findGlbUrl,
  isSettled,
  type Prediction,
  type ReplicateClient,
} from '../src/index.ts';

type Candidate = {
  id: string;
  // A model path (official models) or a version hash (community deployments).
  path?: string;
  version?: string;
  // Listed price per run, or null when it is billed by GPU time.
  listedUsd: number | null;
  usdPerSecond?: number;
  input: Record<string, unknown>;
};

const CANDIDATES: Candidate[] = [
  {
    id: 'trellis1',
    version: BUILD_MODEL.version,
    listedUsd: null,
    usdPerSecond: A100_USD_PER_SECOND,
    input: { ...BUILD_MODEL.input },
  },
  {
    id: 'hunyuan31',
    path: '/models/tencent/hunyuan-3d-3.1/predictions',
    // Replicate lists $0.50 per unit (2026-11).
    listedUsd: 0.5,
    input: { generate_type: 'Normal', enable_pbr: true },
  },
  {
    id: 'trellis2',
    version: '52e1ad6852599ea10ce8e257635a3c11485cba51c181ea5173e34d9b2955b226',
    listedUsd: null,
    usdPerSecond: A100_USD_PER_SECOND,
    input: {
      texture_size: 2048,
      generate_model: true,
      generate_video: false,
      randomize_seed: false,
      seed: 42,
    },
  },
];

// TRELLIS.2 settings (fishwowater/trellis2, same version as `trellis2`). The first run used the page
// defaults for the face count (1,000,000) and gave 31 to 36 MB GLBs. pipeline_type trades speed and
// detail, decimation_target (100,000 to 2,000,000 faces) sets the file size, texture_size the texture.
const trellis2Settings = (
  pipelineType: string,
  decimationTarget: number,
  textureSize: number,
): Candidate => ({
  id: '',
  version: '52e1ad6852599ea10ce8e257635a3c11485cba51c181ea5173e34d9b2955b226',
  listedUsd: null,
  usdPerSecond: A100_USD_PER_SECOND,
  input: {
    pipeline_type: pipelineType,
    decimation_target: decimationTarget,
    texture_size: textureSize,
    generate_model: true,
    generate_video: false,
    randomize_seed: false,
    seed: 42,
  },
});
CANDIDATES.push(
  { ...trellis2Settings('512', 100_000, 1024), id: 't2-low' },
  { ...trellis2Settings('1024_cascade', 200_000, 2048), id: 't2-mid' },
  { ...trellis2Settings('1536_cascade', 500_000, 4096), id: 't2-high' },
);

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
const out = arg('out') ?? 'model3d-out';
const wantedCandidates = list(arg('candidates'));
const wantedPhotos = list(arg('photos'));
const candidates = CANDIDATES.filter((c) => !wantedCandidates || wantedCandidates.includes(c.id));
const photos = PHOTOS.filter((p) => !wantedPhotos || wantedPhotos.includes(p));
if (candidates.length === 0 || photos.length === 0) throw new Error('Nothing selected to run.');

// The client enforces a 45 s budget for its whole lifetime (it is made for one serverless request),
// so a run of many minutes makes a new one per call.
const client: ReplicateClient = {
  upload: (...args) => createReplicate(token).upload(...args),
  start: (...args) => createReplicate(token).start(...args),
  get: (id) => createReplicate(token).get(id),
  cancel: (id) => createReplicate(token).cancel(id),
};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function settle(first: Prediction, limitMs: number): Promise<Prediction> {
  let prediction = first;
  const deadline = Date.now() + limitMs;
  while (!isSettled(prediction.status)) {
    if (Date.now() > deadline) throw new Error(`prediction ${prediction.id} timed out`);
    await sleep(5000);
    prediction = await client.get(prediction.id);
  }
  return prediction;
}

// A model URL, wherever the output keeps it: the first .glb, else the first URL string.
function modelUrl(output: unknown): string | null {
  const glb = findGlbUrl(output);
  if (glb) return glb;
  if (typeof output === 'string' && /^https?:\/\//.test(output)) return output;
  if (Array.isArray(output)) return output.map(modelUrl).find(Boolean) ?? null;
  if (output && typeof output === 'object') {
    return Object.values(output).map(modelUrl).find(Boolean) ?? null;
  }
  return null;
}

type Row = {
  photo: string;
  candidate: string;
  ok: boolean;
  note: string;
  seconds?: number;
  costUsd?: number;
  bytes?: number;
};

async function runOne(photo: string, candidate: Candidate): Promise<Row> {
  const row: Row = { photo, candidate: candidate.id, ok: false, note: '' };
  try {
    const dir = `${out}/${photo}`;
    mkdirSync(dir, { recursive: true });
    const source = new Uint8Array(readFileSync(`apps/web/public/showcase/${photo}.jpg`));
    const image = await client.upload(source, `${photo}.jpg`, 'image/jpeg');
    // TRELLIS v1 takes a list of images; the others take one.
    const input = {
      ...candidate.input,
      ...(candidate.id === 'trellis1' ? { images: [image] } : { image }),
    };
    const started = candidate.version
      ? await client.start('/predictions', { version: candidate.version, input })
      : await client.start(candidate.path as string, { input });
    const done = await settle(started, 40 * 60_000);
    row.seconds = done.metrics?.predict_time;
    row.costUsd =
      candidate.listedUsd ?? (row.seconds ?? 0) * (candidate.usdPerSecond ?? A100_USD_PER_SECOND);
    const url = done.status === 'succeeded' ? modelUrl(done.output) : null;
    if (!url) throw new Error(done.error ?? `build ${done.status}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} answered ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const ext = /\.([a-z0-9]+)(\?|$)/i.exec(url)?.[1] ?? 'bin';
    writeFileSync(`${dir}/${candidate.id}.${ext}`, bytes);
    row.bytes = bytes.byteLength;
    const check = ext === 'glb' ? checkGlb(bytes) : null;
    row.ok = check ? check.ok : false;
    row.note = check
      ? check.ok
        ? 'valid GLB'
        : `${check.code}: ${check.message}`
      : `not a .glb (${ext})`;
  } catch (error) {
    row.note = error instanceof Error ? error.message : String(error);
  }
  return row;
}

const account = await fetch('https://api.replicate.com/v1/account', {
  headers: { Authorization: `Bearer ${token}` },
});
if (!account.ok) {
  console.error(`Replicate refused the token (${account.status}). Nothing was run or spent.`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
const jobs = photos.flatMap((photo) => candidates.map((candidate) => ({ photo, candidate })));
const rows: Row[] = [];
let next = 0;
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      if (!job) return;
      const row = await runOne(job.photo, job.candidate);
      rows.push(row);
      console.log(`${row.photo} / ${row.candidate}: ${row.note}`);
    }
  }),
);

rows.sort((a, b) => a.photo.localeCompare(b.photo) || a.candidate.localeCompare(b.candidate));
writeFileSync(`${out}/results.json`, `${JSON.stringify(rows, null, 2)}\n`);
const usd = (value: number | undefined) => (value === undefined ? '-' : `$${value.toFixed(3)}`);
const summary = [
  '# 3D model bake-off',
  '',
  '| photo | candidate | result | seconds | cost | size |',
  '|---|---|---|---|---|---|',
  ...rows.map(
    (r) =>
      `| ${r.photo} | ${r.candidate} | ${r.ok ? 'ok' : 'FAIL'} ${r.note.replace(/\|/g, '/')} | ${r.seconds?.toFixed(0) ?? '-'} | ${usd(r.costUsd)} | ${r.bytes ?? '-'} |`,
  ),
  '',
  'Shape and texture are judged by eye on the GLBs: the check only catches broken files.',
  '',
].join('\n');
writeFileSync(`${out}/summary.md`, summary);
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY)
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, summary, { flag: 'a' });
if (!rows.some((row) => row.ok)) {
  console.error('No candidate produced a usable model.');
  process.exit(1);
}
