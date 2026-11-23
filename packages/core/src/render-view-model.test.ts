import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { storeViewModel } from './render-view-model';
import { getFile } from './storage';

let directory: string | undefined;
afterEach(async () => {
  vi.unstubAllEnvs();
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function local() {
  directory = await mkdtemp(join(tmpdir(), 'easyrender-view-'));
  vi.stubEnv('DATA_DIR', directory);
  vi.stubEnv('S3_BUCKET', '');
  vi.stubEnv('VERCEL', '');
}

it('stores a lighter copy of a model under its own key', async () => {
  await local();
  const original = new Uint8Array(
    readFileSync(new URL('../../../apps/web/public/showcase/table.glb', import.meta.url)),
  );
  const key = await storeViewModel(original, 'local:models/model.glb');
  expect(key).toMatch(/^local:models\/model-view-/);
  expect((await getFile(key as string)).byteLength).toBeLessThan(original.byteLength / 2);
});

it('points a file it cannot lighten back at the original, so it is never retried', async () => {
  await local();
  expect(await storeViewModel(new Uint8Array([1, 2, 3, 4]), 'local:models/model.glb')).toBe(
    'local:models/model.glb',
  );
});
