/**
 * Sketch-to-3D latency spike for the live sketch canvas (issue #98).
 *
 * Times the two steps a live canvas needs on fal.ai, per sketch:
 *   1. sketch -> image   (first fal LCM or FLUX image-to-image app that exists)
 *   2. image  -> 3D mesh (fal-ai/trellis and fal-ai/triposr)
 * Each call runs twice: the first run includes any cold start, the second is the warm number that
 * matters for a live canvas. It spends real fal credit (about $0.30 for the default set).
 *
 * Needs FAL_KEY. Run it with `bun scripts/sketch-bench.ts --spend`.
 * Output is a Markdown table on stdout plus images and mesh URLs, written to `sketch-bench-out/`.
 *
 * The input shapes below follow fal's public model pages; a model that rejects them fails loudly
 * with the response body instead of being skipped.
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// biome-ignore lint/suspicious/noUndeclaredEnvVars: a manual spike run with bun, never through turbo, so the key stays out of turbo.json.
const FAL_KEY = process.env.FAL_KEY;
const SKETCH_DIR = join(import.meta.dir, 'sketch-bench');
const OUT_DIR = 'sketch-bench-out';
const PROMPT =
  'studio product photo of this piece of furniture, oak and linen, soft daylight, plain white background';

type TimedCall = { coldMs: number; warmMs: number; output: unknown };

function toDataUri(png: Uint8Array): string {
  return `data:image/png;base64,${Buffer.from(png).toString('base64')}`;
}

async function callFal(model: string, input: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(`https://fal.run/${model}`, {
    method: 'POST',
    headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${model} ${response.status}: ${text.slice(0, 400)}`);
  }
  return JSON.parse(text);
}

async function timeTwice(model: string, input: Record<string, unknown>): Promise<TimedCall> {
  const firstStart = performance.now();
  await callFal(model, input);
  const coldMs = performance.now() - firstStart;
  const secondStart = performance.now();
  const output = await callFal(model, input);
  return { coldMs, warmMs: performance.now() - secondStart, output };
}

// fal retires and renames apps, so try each sketch-to-image candidate in order and skip only the
// ones fal says do not exist. Any other error (auth, bad input) stops the run with its body.
const MESH_MODELS: { id: string; imageKey: string }[] = [
  { id: 'fal-ai/trellis', imageKey: 'image_url' },
  { id: 'fal-ai/hunyuan3d/v2/turbo', imageKey: 'input_image_url' },
  { id: 'fal-ai/triposr', imageKey: 'image_url' },
];

const SKETCH_MODELS: { id: string; steps: number }[] = [
  { id: 'fal-ai/lcm-sd15-i2i', steps: 4 },
  { id: 'fal-ai/fast-lcm-diffusion/image-to-image', steps: 4 },
  // fal rejects fewer than 10 steps here (422 on 2026-11-13).
  { id: 'fal-ai/flux/dev/image-to-image', steps: 12 },
];

async function sketchToImage(sketch: string): Promise<TimedCall & { model: string }> {
  for (const { id: model, steps } of SKETCH_MODELS) {
    try {
      const timed = await timeTwice(model, {
        image_url: sketch,
        prompt: PROMPT,
        strength: 0.85,
        num_inference_steps: steps,
      });
      return { ...timed, model };
    } catch (error) {
      if (error instanceof Error && error.message.includes(` 404: `)) continue;
      throw error;
    }
  }
  throw new Error(
    `None of the sketch-to-image apps exist on fal: ${SKETCH_MODELS.map((candidate) => candidate.id).join(', ')}`,
  );
}

function firstUrl(output: unknown, keys: string[]): string | undefined {
  if (typeof output !== 'object' || output === null) return undefined;
  const record = output as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && value.length > 0) {
      const head: unknown = value[0];
      if (typeof head === 'object' && head !== null && 'url' in head) {
        return String((head as { url: unknown }).url);
      }
    }
    if (typeof value === 'object' && value !== null && 'url' in value) {
      return String((value as { url: unknown }).url);
    }
  }
  return undefined;
}

async function main() {
  if (!process.argv.includes('--spend')) {
    throw new Error('This spends fal credit. Re-run with --spend.');
  }
  if (!FAL_KEY) throw new Error('FAL_KEY is not set.');

  await mkdir(OUT_DIR, { recursive: true });
  const files = (await readdir(SKETCH_DIR)).filter((name) => name.endsWith('.png')).sort();
  const rows: string[] = [];
  const links: string[] = [];

  for (const file of files) {
    const name = file.replace(/\.png$/, '');
    const sketch = toDataUri(await readFile(join(SKETCH_DIR, file)));

    const image = await sketchToImage(sketch);
    const imageUrl = firstUrl(image.output, ['images', 'image']);
    if (!imageUrl) throw new Error(`No image in ${image.model} output for ${name}`);
    rows.push(
      `| ${name} | sketch to image (${image.model.replace('fal-ai/', '')}) | ${(image.coldMs / 1000).toFixed(1)} | ${(image.warmMs / 1000).toFixed(1)} |`,
    );
    links.push(`- ${name} render: ${imageUrl}`);

    // A mesh model that fails (retired app, different input name) is a result, not a reason to
    // lose the rest of the run: record it in the table and move on.
    for (const { id: model, imageKey } of MESH_MODELS) {
      const label = model.replace('fal-ai/', '');
      try {
        const mesh = await timeTwice(model, { [imageKey]: imageUrl });
        const meshUrl = firstUrl(mesh.output, ['model_mesh', 'model_mesh_url', 'mesh']);
        rows.push(
          `| ${name} | image to 3D (${label}) | ${(mesh.coldMs / 1000).toFixed(1)} | ${(mesh.warmMs / 1000).toFixed(1)} |`,
        );
        links.push(`- ${name} ${model}: ${meshUrl ?? 'no mesh url in output'}`);
      } catch (error) {
        const reason = error instanceof Error ? error.message.slice(0, 160) : 'unknown error';
        rows.push(`| ${name} | image to 3D (${label}) | failed | ${reason.replaceAll('|', '/')} |`);
      }
    }
  }

  const report = [
    '## Sketch to 3D latency (fal.ai)',
    '',
    'Seconds, wall clock from this runner, including network. Cold is the first call, warm the second.',
    '',
    '| Sketch | Step | Cold s | Warm s |',
    '|---|---|---|---|',
    ...rows,
    '',
    '### Outputs (open to judge quality)',
    ...links,
    '',
  ].join('\n');
  await writeFile(join(OUT_DIR, 'report.md'), report);
  console.write(`${report}\n`);
}

await main();
