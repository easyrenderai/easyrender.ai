// Upscaler bake-off: enlarges real interior and product pictures with each candidate model on
// Replicate (and fal, when FAL_KEY is set), then compares them on what code can measure plus a
// crop strip a person looks at. Interiors are the reason: a staged room has wood grain, fabric,
// stone and glass that a plain upscaler smears and a creative one invents.
//
// Usage: REPLICATE_API_TOKEN=... [FAL_KEY=...] bun packages/harness/scripts/upscale-bakeoff.ts --spend
//          [--candidates=esrgan,crisp] [--images=interior,sofa] [--out=upscale-out]
//
// It spends money, so it refuses to run without --spend (about $1 to $3 for the full set). Per
// image and candidate it writes the output, results.json, summary.md and a crop strip.
//
// Two kinds of image: "real" ones are enlarged as they are (a person judges the result), and "gt"
// ones are first shrunk to half, enlarged 2x and compared with the original, so PSNR is a real
// number. PSNR rewards smoothness, so it is only half the story: `detail` is the share of edge
// energy of the original that survives, and a creative model can top 100% by inventing texture.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp, { type OverlayOptions } from 'sharp';
import { createReplicate, isSettled, type Prediction, type ReplicateClient } from '../src/index.ts';

type Provider = 'replicate' | 'fal';
type Candidate = {
  id: string;
  provider: Provider;
  model: string;
  // Price per image as listed (secondary sources, 2026-11, 2x of a ~0.5 MP picture); the run
  // records the real time, and the model page's own price text is scraped into the summary.
  listedUsd: number;
  input: (image: string, scale: number) => Record<string, unknown>;
};

// Not listed: philz1337x/clarity-upscaler, google/upscaler and zsxkib/seedvr2 answered 404 or 422 on
// Replicate on 2026-11-14 (no such public model for this token); fal's clarity and SeedVR are below.
const candidates: Candidate[] = [
  {
    id: 'esrgan',
    provider: 'replicate',
    model: 'nightmareai/real-esrgan',
    listedUsd: 0.002,
    input: (image, scale) => ({ image, scale, face_enhance: false }),
  },
  {
    id: 'crisp',
    provider: 'replicate',
    model: 'recraft-ai/recraft-crisp-upscale',
    listedUsd: 0.004,
    input: (image) => ({ image }),
  },
  {
    id: 'topaz',
    provider: 'replicate',
    model: 'topazlabs/image-upscale',
    listedUsd: 0.05,
    input: (image, scale) => ({
      image,
      enhance_model: 'Standard V2',
      upscale_factor: `${scale}x`,
      output_format: 'png',
    }),
  },
  {
    id: 'bria',
    provider: 'replicate',
    model: 'bria/increase-resolution',
    listedUsd: 0.04,
    input: (image, scale) => ({ image, desired_increase: scale, preserve_alpha: false }),
  },
  {
    id: 'fal-seedvr',
    provider: 'fal',
    model: 'fal-ai/seedvr/upscale/image',
    listedUsd: 0.01,
    input: (image, scale) => ({ image_url: image, upscale_factor: scale, output_format: 'png' }),
  },
  {
    id: 'fal-aura',
    provider: 'fal',
    model: 'fal-ai/aura-sr',
    listedUsd: 0.002,
    input: (image) => ({ image_url: image, upscaling_factor: 4 }),
  },
  {
    id: 'fal-clarity',
    provider: 'fal',
    model: 'fal-ai/clarity-upscaler',
    listedUsd: 0.03,
    input: (image, scale) => ({ image_url: image, upscale_factor: scale }),
  },
  {
    id: 'fal-crisp',
    provider: 'fal',
    model: 'fal-ai/recraft/upscale/crisp',
    listedUsd: 0.004,
    input: (image) => ({ image_url: image }),
  },
];

type Case = { id: string; file: string; kind: 'real' | 'gt'; note: string };
const PUBLIC = 'apps/web/public';
const CASES: Case[] = [
  { id: 'interior', file: `${PUBLIC}/studio/interior.jpg`, kind: 'real', note: 'dim staged room' },
  { id: 'room-ar', file: `${PUBLIC}/studio/room-ar.jpg`, kind: 'real', note: 'portrait room' },
  { id: 'sofa', file: `${PUBLIC}/studio/photos/sofa.jpg`, kind: 'real', note: 'product, fabric' },
  { id: 'lamp', file: `${PUBLIC}/studio/photos/lamp.jpg`, kind: 'real', note: 'product, metal' },
  {
    id: 'sneaker',
    file: `${PUBLIC}/studio/photos/sneaker.jpg`,
    kind: 'real',
    note: 'product, mesh',
  },
  {
    id: 'barrel',
    file: `${PUBLIC}/studio/photos/barrel.jpg`,
    kind: 'real',
    note: 'product, wood grain',
  },
  {
    id: 'big',
    file: `${PUBLIC}/studio/interior.jpg`,
    kind: 'real',
    note: 'the room at 2000 px: the size of a product view, to check limits, time and price',
  },
  {
    id: 'gt-hero',
    file: `${PUBLIC}/blog/illustrations/sell-vintage-furniture-online/hero.webp`,
    kind: 'gt',
    note: 'room scene, shrunk to half',
  },
  { id: 'gt-interior', file: `${PUBLIC}/studio/interior.jpg`, kind: 'gt', note: 'room, half' },
  { id: 'gt-armchair', file: `${PUBLIC}/showcase/armchair.jpg`, kind: 'gt', note: 'product, half' },
];

const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const list = (value: string | undefined) => value?.split(',').filter(Boolean);

if (!process.argv.includes('--spend')) {
  console.error('This spends money on Replicate and fal. Run again with --spend.');
  process.exit(1);
}
const token = process.env.REPLICATE_API_TOKEN ?? '';
const falKey = process.env.FAL_KEY ?? '';
const out = arg('out') ?? 'upscale-out';
const wantedCandidates = list(arg('candidates'));
const wantedImages = list(arg('images'));
const SCALE = Number(arg('scale') ?? 2);
const active = candidates.filter(
  (c) =>
    (!wantedCandidates || wantedCandidates.includes(c.id)) &&
    (c.provider === 'replicate' || falKey),
);
const cases = CASES.filter((c) => !wantedImages || wantedImages.includes(c.id));
if (active.length === 0 || cases.length === 0) throw new Error('Nothing selected to run.');
if (!falKey) console.warn('FAL_KEY is not set: the fal candidates are skipped.');

const replicate: ReplicateClient = createReplicate(token);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

// The inputs a Replicate model really takes, from its published schema, so a wrong key is dropped
// and logged instead of failing the run. Also its licence and whether it is hosted by Replicate.
type ModelInfo = { inputs: Set<string> | null; license: string | null };
async function modelInfo(model: string): Promise<ModelInfo> {
  const response = await fetch(`https://api.replicate.com/v1/models/${model}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return { inputs: null, license: `model lookup ${response.status}` };
  const body = (await response.json()) as {
    license_url?: string | null;
    latest_version?: {
      openapi_schema?: { components?: { schemas?: { Input?: { properties?: object } } } };
    };
  };
  const properties = body.latest_version?.openapi_schema?.components?.schemas?.Input?.properties;
  return {
    inputs: properties ? new Set(Object.keys(properties)) : null,
    license: body.license_url ?? null,
  };
}

// The price text on the model's own page, when it can be read ("$0.004 per output image").
async function pageprice(candidate: Candidate): Promise<string> {
  const url =
    candidate.provider === 'replicate'
      ? `https://replicate.com/${candidate.model}`
      : `https://fal.ai/models/${candidate.model}`;
  try {
    const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const text = (await response.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const raw = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } }).then((r) =>
      r.text(),
    );
    const described = [...raw.matchAll(/"description":\s*"([^"]*\$[^"]*)"/g)].map((m) => m[1]);
    const hit = text.match(/.{0,50}\$\s?\d+(\.\d+)?.{0,60}(image|run|megapixel|output|second)/i);
    return described.length
      ? described.slice(0, 4).join(' ; ')
      : hit
        ? hit[0].trim()
        : `no price text (HTTP ${response.status})`;
  } catch (error) {
    return `page not read: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function firstUrl(output: unknown): string | null {
  if (typeof output === 'string') return /^https?:/.test(output) ? output : null;
  if (Array.isArray(output)) return output.map(firstUrl).find(Boolean) ?? null;
  if (output && typeof output === 'object') {
    const record = output as Record<string, unknown>;
    for (const key of ['image', 'images', 'output', 'url']) {
      const hit = key in record ? firstUrl(record[key]) : null;
      if (hit) return hit;
    }
    return Object.values(record).map(firstUrl).find(Boolean) ?? null;
  }
  return null;
}

async function settle(first: Prediction): Promise<Prediction> {
  let prediction = first;
  const deadline = Date.now() + 10 * 60_000;
  while (!isSettled(prediction.status)) {
    if (Date.now() > deadline) throw new Error(`prediction ${prediction.id} timed out`);
    await sleep(3000);
    prediction = await replicate.get(prediction.id);
  }
  return prediction;
}

async function runReplicate(
  candidate: Candidate,
  imageUrl: string,
  info: ModelInfo | undefined,
): Promise<{ bytes: Uint8Array; seconds: number | undefined }> {
  const input = candidate.input(imageUrl, SCALE);
  for (const key of Object.keys(input)) {
    if (info?.inputs && !info.inputs.has(key)) {
      console.warn(`${candidate.model}: input "${key}" is not in its schema, dropped`);
      delete input[key];
    }
  }
  const done = await settle(
    await replicate.start(`/models/${candidate.model}/predictions`, { input }),
  );
  const url = done.status === 'succeeded' ? firstUrl(done.output) : null;
  if (!url) throw new Error(done.error ?? `prediction ${done.status}`);
  return { bytes: await fetchBytes(url), seconds: done.metrics?.predict_time };
}

async function runFal(
  candidate: Candidate,
  source: Uint8Array,
): Promise<{ bytes: Uint8Array; seconds: number | undefined }> {
  const started = Date.now();
  const dataUri = `data:image/png;base64,${Buffer.from(source).toString('base64')}`;
  const headers = { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' };
  const queued = await fetch(`https://queue.fal.run/${candidate.model}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(candidate.input(dataUri, SCALE)),
  });
  if (!queued.ok) throw new Error(`fal ${queued.status} ${(await queued.text()).slice(0, 200)}`);
  const job = (await queued.json()) as { status_url: string; response_url: string };
  const deadline = Date.now() + 10 * 60_000;
  for (;;) {
    if (Date.now() > deadline) throw new Error('fal request timed out');
    await sleep(2500);
    const status = (await (await fetch(job.status_url, { headers })).json()) as {
      status?: string;
    };
    if (status.status === 'COMPLETED') break;
    if (status.status && !['IN_QUEUE', 'IN_PROGRESS'].includes(status.status)) {
      throw new Error(`fal status ${status.status}`);
    }
  }
  const result = await fetch(job.response_url, { headers });
  if (!result.ok)
    throw new Error(`fal result ${result.status} ${(await result.text()).slice(0, 200)}`);
  const url = firstUrl(await result.json());
  if (!url) throw new Error('fal returned no image');
  return { bytes: await fetchBytes(url), seconds: (Date.now() - started) / 1000 };
}

// --- Measuring ------------------------------------------------------------------------------

const GRID = 256;
async function gray(
  image: Uint8Array | string,
): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(image)
    .resize(GRID, GRID, { fit: 'fill', kernel: 'lanczos3' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

// Mean absolute gradient: how much edge energy the picture carries on a fixed grid.
function edgeEnergy({ data, width, height }: { data: Buffer; width: number; height: number }) {
  let sum = 0;
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const i = y * width + x;
      sum +=
        Math.abs((data[i] ?? 0) - (data[i + 1] ?? 0)) +
        Math.abs((data[i] ?? 0) - (data[i + width] ?? 0));
    }
  }
  return sum / ((width - 1) * (height - 1));
}

async function psnr(a: Uint8Array, b: Uint8Array): Promise<number> {
  const side = 512;
  const raw = (image: Uint8Array) =>
    sharp(image)
      .resize(side, side, { fit: 'fill', kernel: 'lanczos3' })
      .removeAlpha()
      .raw()
      .toBuffer();
  const [x, y] = await Promise.all([raw(a), raw(b)]);
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += ((x[i] ?? 0) - (y[i] ?? 0)) ** 2;
  const mse = sum / x.length;
  return mse === 0 ? 99 : 10 * Math.log10(255 ** 2 / mse);
}

type Row = {
  image: string;
  candidate: string;
  provider: Provider;
  ok: boolean;
  note: string;
  width?: number;
  height?: number;
  seconds?: number;
  listedUsd: number;
  detail?: number;
  psnr?: number;
  psnrBaseline?: number;
};

// What each case feeds the models, and what the result is compared with.
async function prepare(c: Case) {
  const original = new Uint8Array(readFileSync(c.file));
  if (c.id === 'big') {
    const large = await sharp(original)
      .resize(2000, 2000, { fit: 'inside', kernel: 'lanczos3' })
      .jpeg({ quality: 95 })
      .toBuffer();
    return { input: new Uint8Array(large), truth: null as Uint8Array | null };
  }
  if (c.kind === 'real') return { input: original, truth: null as Uint8Array | null };
  const meta = await sharp(original).metadata();
  const half = await sharp(original)
    .resize(Math.round((meta.width ?? 2) / 2), Math.round((meta.height ?? 2) / 2), {
      kernel: 'lanczos3',
    })
    .jpeg({ quality: 92 })
    .toBuffer();
  return { input: new Uint8Array(half), truth: original };
}

const infos = new Map<string, ModelInfo>();
async function runOne(c: Case, candidate: Candidate): Promise<Row> {
  const row: Row = {
    image: c.id,
    candidate: candidate.id,
    provider: candidate.provider,
    ok: false,
    note: '',
    listedUsd: candidate.listedUsd,
  };
  try {
    const { input, truth } = await prepare(c);
    const dir = `${out}/${c.id}`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/input.png`, await sharp(input).png().toBuffer());
    const result =
      candidate.provider === 'fal'
        ? await runFal(candidate, new Uint8Array(await sharp(input).png().toBuffer()))
        : await runReplicate(
            candidate,
            await replicate.upload(input, `${c.id}.png`, 'image/png'),
            infos.get(candidate.model),
          );
    const png = await sharp(result.bytes).png().toBuffer();
    writeFileSync(`${dir}/${candidate.id}.png`, png);
    const meta = await sharp(png).metadata();
    Object.assign(row, {
      ok: true,
      note: 'ok',
      width: meta.width,
      height: meta.height,
      seconds: result.seconds,
    });
    const baseline = await sharp(input)
      .resize(meta.width, meta.height, { kernel: 'lanczos3' })
      .png()
      .toBuffer();
    const base = edgeEnergy(await gray(baseline));
    row.detail = base > 0 ? edgeEnergy(await gray(png)) / base : undefined;
    if (truth) {
      row.psnr = await psnr(png, truth);
      row.psnrBaseline = await psnr(baseline, truth);
    }
  } catch (error) {
    row.note = error instanceof Error ? error.message.slice(0, 300) : String(error);
  }
  return row;
}

// One strip per image: the same detail-rich crop of the plain Lanczos enlargement and each result.
async function strip(c: Case, ids: string[]) {
  const dir = `${out}/${c.id}`;
  const input = await sharp(`${dir}/input.png`).metadata();
  const w = input.width ?? 1;
  const h = input.height ?? 1;
  // The crop is the block of the input with the most edge energy.
  const block = Math.max(64, Math.floor(Math.min(w, h) / 4));
  let best = { x: 0, y: 0, score: -1 };
  for (let y = 0; y + block <= h; y += block) {
    for (let x = 0; x + block <= w; x += block) {
      const tile = await sharp(`${dir}/input.png`)
        .extract({ left: x, top: y, width: block, height: block })
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const score = edgeEnergy({
        data: tile.data,
        width: tile.info.width,
        height: tile.info.height,
      });
      if (score > best.score) best = { x, y, score };
    }
  }
  const tileSize = 380;
  const names = ['lanczos', ...ids];
  const tiles: OverlayOptions[] = [];
  for (const [index, name] of names.entries()) {
    try {
      const file = name === 'lanczos' ? `${dir}/input.png` : `${dir}/${name}.png`;
      const meta = await sharp(file).metadata();
      const factor = (meta.width ?? w) / w;
      const crop = await sharp(file)
        .extract({
          left: Math.round(best.x * factor),
          top: Math.round(best.y * factor),
          width: Math.round(block * factor),
          height: Math.round(block * factor),
        })
        .resize(tileSize, tileSize, { kernel: name === 'lanczos' ? 'lanczos3' : 'lanczos3' })
        .png()
        .toBuffer();
      tiles.push({ input: crop, left: index * tileSize, top: 26 });
      tiles.push({
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${tileSize}" height="26"><text x="6" y="18" font-size="15" font-family="sans-serif">${name}</text></svg>`,
        ),
        left: index * tileSize,
        top: 0,
      });
    } catch {
      // A candidate with no output leaves a blank tile.
    }
  }
  await sharp({
    create: {
      width: tileSize * names.length,
      height: tileSize + 26,
      channels: 3,
      background: '#fff',
    },
  })
    .composite(tiles)
    .jpeg({ quality: 88 })
    .toFile(`${dir}/crops.jpg`);
}

// A bad token fails here, before any prediction is paid for.
const account = await fetch('https://api.replicate.com/v1/account', {
  headers: { Authorization: `Bearer ${token}` },
});
if (!account.ok) {
  console.error(`Replicate refused the token (${account.status}). Nothing was run or spent.`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
for (const candidate of active.filter((c) => c.provider === 'replicate')) {
  infos.set(candidate.model, await modelInfo(candidate.model));
}
const prices = new Map<string, string>();
for (const candidate of active) prices.set(candidate.id, await pageprice(candidate));

const jobs = cases.flatMap((c) => active.map((candidate) => ({ c, candidate })));
const rows: Row[] = [];
let next = 0;
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      if (!job) return;
      const row = await runOne(job.c, job.candidate);
      rows.push(row);
      console.log(
        `${row.image} / ${row.candidate}: ${row.note} ${row.width ?? ''}x${row.height ?? ''} ${row.seconds?.toFixed(1) ?? '-'}s detail=${row.detail?.toFixed(2) ?? '-'} psnr=${row.psnr?.toFixed(2) ?? '-'}`,
      );
    }
  }),
);

for (const c of cases) {
  await strip(
    c,
    active.map((candidate) => candidate.id),
  );
}

rows.sort((a, b) => a.image.localeCompare(b.image) || a.candidate.localeCompare(b.candidate));
writeFileSync(`${out}/results.json`, `${JSON.stringify(rows, null, 2)}\n`);

const num = (value: number | undefined, digits = 2) =>
  value === undefined ? '-' : value.toFixed(digits);
const perCandidate = active.map((candidate) => {
  const mine = rows.filter((r) => r.candidate === candidate.id);
  const okRows = mine.filter((r) => r.ok);
  const mean = (pick: (r: Row) => number | undefined) => {
    const values = okRows.map(pick).filter((v): v is number => v !== undefined);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined;
  };
  const failure = mine.find((r) => !r.ok)?.note.replace(/\|/g, '/') ?? '';
  const gain = mean((r) =>
    r.psnr !== undefined && r.psnrBaseline !== undefined ? r.psnr - r.psnrBaseline : undefined,
  );
  const license = infos.get(candidate.model)?.license ?? '-';
  return `| ${candidate.id} | ${candidate.model} | ${okRows.length}/${mine.length} | ${num(
    mean((r) => r.seconds),
    1,
  )}s | ${num(mean((r) => r.detail))} | ${num(gain)} dB | $${candidate.listedUsd} | ${(prices.get(candidate.id) ?? '').replace(/\|/g, '/')} | ${license} | ${failure.slice(0, 120)} |`;
});
writeFileSync(
  `${out}/summary.md`,
  [
    '# Upscaler bake-off',
    '',
    `Scale ${SCALE}x. "detail" is edge energy relative to a plain Lanczos enlargement (1.0 = no new edges; much above 1.3 is likely invented texture). "PSNR gain" is over Lanczos on the half-size cases, where the original is the truth. Listed $ is from secondary sources; "page price" is read from the model page when possible.`,
    '',
    '| candidate | model | ok | mean time | detail | PSNR gain | listed $ | page price | licence | first failure |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...perCandidate,
    '',
    'Look at upscale-out/<image>/crops.jpg for each image: shape, material and invented texture are judged by eye.',
    '',
  ].join('\n'),
);
console.log(readFileSync(`${out}/summary.md`, 'utf8'));
