import { createVerify, generateKeyPairSync } from 'node:crypto';
import { readGlbMaterials } from '@easyrender/harness';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  renders: new Map<string, Record<string, unknown>>(),
  windows: new Map<string, number>(),
  files: new Map<string, Uint8Array>(),
}));

vi.mock('@easyrender/db', () => ({
  db: () => ({
    render: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.renders.get(where.id) ?? null,
    },
    apiRateWindow: {
      upsert: async ({ where }: { where: { id: string } }) => {
        const count = (state.windows.get(where.id) ?? 0) + 1;
        state.windows.set(where.id, count);
        return { count };
      },
    },
  }),
  Prisma: {},
}));
vi.mock('./storage', () => ({
  getFile: async (key: string) => state.files.get(key) ?? new Uint8Array(),
}));

import { createModelExport, type ModelExportGateway, signExportUrl } from './model-exports';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

// A small one-material GLB with a binary chunk, built by hand.
function makeGlb(materials: object[]) {
  const json = new TextEncoder().encode(JSON.stringify({ asset: { version: '2.0' }, materials }));
  const bin = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const padded = Math.ceil(json.byteLength / 4) * 4;
  const out = new Uint8Array(12 + 8 + padded + 8 + bin.byteLength);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, out.byteLength, true);
  view.setUint32(12, padded, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(json, 20);
  out.fill(0x20, 20 + json.byteLength, 20 + padded);
  view.setUint32(20 + padded, bin.byteLength, true);
  view.setUint32(24 + padded, 0x004e4942, true);
  out.set(bin, 28 + padded);
  return out;
}

// The private bucket and the converter, in memory. The converter "writes" its output the way the
// real one does, so a second request can find it.
function fakeAws(options: { convertError?: string } = {}) {
  const objects = new Map<string, { bytes: Uint8Array; writtenAt: Date }>();
  const conversions: { sourceKey: string; format: string; outputKey: string }[] = [];
  let clock = new Date('2026-11-16T10:00:00Z');
  const gateway: ModelExportGateway = {
    writtenAt: async (key) => objects.get(key)?.writtenAt ?? null,
    put: async (key, bytes) => {
      objects.set(key, { bytes, writtenAt: clock });
    },
    convert: async (request) => {
      conversions.push(request);
      if (options.convertError) return { ok: false, error: options.convertError };
      objects.set(request.outputKey, { bytes: new Uint8Array([1]), writtenAt: clock });
      return { ok: true };
    },
    signingKey: async () => privateKey,
  };
  return {
    gateway,
    objects,
    conversions,
    at: (time: string) => {
      clock = new Date(time);
      return clock;
    },
  };
}

const owner = { userId: 'owner' };
const NOW = new Date('2026-11-16T10:00:00Z');

beforeEach(() => {
  state.renders.clear();
  state.windows.clear();
  state.files.clear();
  state.files.set('stored.glb', makeGlb([{ pbrMetallicRoughness: { roughnessFactor: 1 } }]));
  state.renders.set('r1', {
    id: 'r1',
    userId: 'owner',
    anonId: null,
    status: 'ready',
    glbKey: 'stored.glb',
    materialEdits: [],
    updatedAt: new Date('2026-11-15T08:00:00Z'),
  });
  vi.stubEnv('EXPORTS_BUCKET', 'exports-bucket');
  vi.stubEnv('EXPORTS_CDN_URL', 'https://cdn.example.test/exports/');
  vi.stubEnv('EXPORTS_KEY_PAIR_ID', 'K123');
  vi.stubEnv('MODEL_EXPORT_FUNCTION', 'converter');
});
afterEach(() => vi.unstubAllEnvs());

function verifies(link: string) {
  const url = new URL(link);
  const expires = Number(url.searchParams.get('Expires'));
  const signature = (url.searchParams.get('Signature') ?? '')
    .replace(/-/g, '+')
    .replace(/_/g, '=')
    .replace(/~/g, '/');
  const resource = `${url.origin}${url.pathname}`;
  const policy = JSON.stringify({
    Statement: [{ Resource: resource, Condition: { DateLessThan: { 'AWS:EpochTime': expires } } }],
  });
  return createVerify('RSA-SHA1').update(policy).verify(publicKey, signature, 'base64');
}

describe('exporting a render to another 3D format', () => {
  it.each([
    ['obj', 'zip'],
    ['fbx', 'fbx'],
    ['blend', 'blend'],
  ] as const)('gives the owner a signed, ten-minute link for %s', async (format, extension) => {
    const aws = fakeAws();

    const result = await createModelExport('r1', owner, format, aws.gateway, NOW);

    const url = new URL(result.url);
    const version = new Date('2026-11-15T08:00:00Z').getTime();
    expect(`${url.origin}${url.pathname}`).toBe(
      `https://cdn.example.test/exports/r1/${version}/model-${format}.${extension}`,
    );
    expect(url.searchParams.get('Key-Pair-Id')).toBe('K123');
    expect(url.searchParams.get('Expires')).toBe(String(NOW.getTime() / 1000 + 600));
    expect(verifies(result.url)).toBe(true);
    expect(result).toMatchObject({
      format,
      filename: `easyrender-r1-${format}.${extension}`,
      expiresAt: '2026-11-16T10:10:00.000Z',
    });
    // The converter was asked for exactly that file, inside the private exports folder.
    expect(aws.conversions).toEqual([
      {
        sourceKey: `exports/r1/${version}/source.glb`,
        format,
        outputKey: `exports/r1/${version}/model-${format}.${extension}`,
        downloadName: `easyrender-r1-${format}`,
      },
    ]);
  });

  it('exports the model with the owner’s material edits, not the stored original', async () => {
    state.renders.set('r1', {
      ...state.renders.get('r1'),
      materialEdits: [{ index: 0, baseColor: [0.5, 0.25, 1], roughness: 0.3, metalness: 0.1 }],
    });
    const aws = fakeAws();

    await createModelExport('r1', owner, 'fbx', aws.gateway, NOW);

    const [request] = aws.conversions;
    const source = aws.objects.get(request.sourceKey)?.bytes ?? new Uint8Array();
    expect(readGlbMaterials(source)).toEqual([
      { index: 0, name: null, baseColor: [0.5, 0.25, 1], roughness: 0.3, metalness: 0.1 },
    ]);
  });

  it('links the file it already made instead of converting twice, until an edit changes it', async () => {
    const aws = fakeAws();
    const first = await createModelExport('r1', owner, 'obj', aws.gateway, NOW);

    const again = await createModelExport('r1', owner, 'obj', aws.gateway, NOW);
    expect(new URL(again.url).pathname).toBe(new URL(first.url).pathname);
    expect(aws.conversions).toHaveLength(1);

    state.renders.set('r1', {
      ...state.renders.get('r1'),
      updatedAt: new Date('2026-11-16T09:59:00Z'),
    });
    const edited = await createModelExport('r1', owner, 'obj', aws.gateway, NOW);
    expect(new URL(edited.url).pathname).not.toBe(new URL(first.url).pathname);
    expect(aws.conversions).toHaveLength(2);
  });

  it('converts again when the stored file is close to its one-day deletion', async () => {
    const aws = fakeAws();
    aws.at('2026-11-15T20:00:00Z');
    await createModelExport('r1', owner, 'blend', aws.gateway, new Date('2026-11-15T20:00:00Z'));

    await createModelExport('r1', owner, 'blend', aws.gateway, new Date('2026-11-16T09:00:00Z'));

    expect(aws.conversions).toHaveLength(2);
  });

  it.each([
    ['someone else', { userId: 'intruder' }],
    ['a visitor who is not signed in', { anonId: 'anon' }],
  ])('answers not found to %s and starts nothing', async (_who, actor) => {
    const aws = fakeAws();

    await expect(createModelExport('r1', actor, 'obj', aws.gateway, NOW)).rejects.toMatchObject({
      status: 404,
      code: 'not_found',
    });
    expect(aws.conversions).toEqual([]);
    expect(aws.objects.size).toBe(0);
  });

  it('answers not found for a render that does not exist', async () => {
    await expect(
      createModelExport('missing', owner, 'obj', fakeAws().gateway, NOW),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('refuses a format it does not make', async () => {
    const aws = fakeAws();

    await expect(createModelExport('r1', owner, 'stl', aws.gateway, NOW)).rejects.toMatchObject({
      status: 400,
      code: 'bad_body',
    });
    expect(aws.conversions).toEqual([]);
  });

  it('refuses a render whose 3D model is not built yet', async () => {
    state.renders.set('r1', { ...state.renders.get('r1'), status: 'preview_ready', glbKey: null });

    await expect(
      createModelExport('r1', owner, 'obj', fakeAws().gateway, NOW),
    ).rejects.toMatchObject({ status: 409, code: 'not_ready' });
  });

  it('says exports are unavailable when the deployment has no converter configured', async () => {
    vi.stubEnv('MODEL_EXPORT_FUNCTION', '');
    const aws = fakeAws();

    await expect(createModelExport('r1', owner, 'obj', aws.gateway, NOW)).rejects.toMatchObject({
      status: 503,
      code: 'exports_unavailable',
    });
    expect(aws.conversions).toEqual([]);
  });

  it('reports a model the converter cannot read and hands out no link', async () => {
    const aws = fakeAws({ convertError: 'The model could not be read as GLB' });

    await expect(createModelExport('r1', owner, 'obj', aws.gateway, NOW)).rejects.toMatchObject({
      status: 422,
      code: 'export_failed',
      message: 'The model could not be converted: The model could not be read as GLB',
    });
  });

  it('stops one account after 30 exports in an hour', async () => {
    const aws = fakeAws();
    for (let count = 0; count < 30; count += 1) {
      await createModelExport('r1', owner, 'obj', aws.gateway, NOW);
    }

    await expect(createModelExport('r1', owner, 'obj', aws.gateway, NOW)).rejects.toMatchObject({
      status: 429,
      code: 'rate_limit',
    });
  });
});

describe('signing an export link', () => {
  it('produces a signature CloudFront can check with the public key, in URL-safe form', () => {
    const link = signExportUrl(
      'https://cdn.example.test/exports/r1/1/model-obj.zip',
      'K123',
      privateKey,
      new Date('2026-11-16T10:10:00Z'),
    );

    expect(verifies(link)).toBe(true);
    expect(new URL(link).searchParams.get('Signature')).not.toMatch(/[+=/]/);
    // The signature covers the address: the same signature on another file does not verify.
    expect(verifies(link.replace('model-obj.zip', 'model-fbx.fbx'))).toBe(false);
  });
});
