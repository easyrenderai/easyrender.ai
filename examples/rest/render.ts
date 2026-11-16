#!/usr/bin/env node
// Node.js 24+, native type stripping, no dependencies. See README.md.
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

type Json = Record<string, unknown>;
class WorkflowError extends Error {}
const MAX_IMAGE = 4 * 1024 * 1024;
const MAX_MODEL = 128 * 1024 * 1024;
const emit = (value: unknown) =>
  process.stdout.write(`${typeof value === 'string' ? value : JSON.stringify(value)}\n`);
function integer(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new WorkflowError(`${name} must be a non-negative safe integer`);
  return value;
}
function identifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(value))
    throw new WorkflowError('Invalid resource identifier');
  return value;
}
function object(value: unknown): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new WorkflowError('Expected a JSON object');
  return value as Json;
}
function save(path: string, value: Json) {
  const temporary = `${path}.tmp-${randomBytes(6).toString('hex')}`;
  try {
    writeFileSync(temporary, JSON.stringify(value), { flag: 'wx', mode: 0o600, flush: true });
    renameSync(temporary, path);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}
async function main() {
  const { values: args } = parseArgs({
    options: {
      help: { type: 'boolean' },
      'base-url': { type: 'string', default: 'https://easyrender.ai' },
      'allow-local-http': { type: 'boolean' },
      state: { type: 'string' },
      image: { type: 'string' },
      'idempotency-key': { type: 'string' },
      'render-id': { type: 'string' },
      'approve-build': { type: 'boolean' },
      'max-credits': { type: 'string' },
      output: { type: 'string', default: 'model.glb' },
      receipt: { type: 'string' },
      'poll-seconds': { type: 'string', default: '5' },
      'timeout-seconds': { type: 'string', default: '600' },
      'request-timeout-seconds': { type: 'string', default: '30' },
    },
  });
  if (args.help) {
    emit(
      'Usage: node render.ts --state job.json [--image photo.jpg --idempotency-key stable-key | --render-id ID] [--approve-build --max-credits N] [--output model.glb] [--receipt receipt.json]. See README.md for timeouts and recovery.',
    );
    return;
  }
  const started = performance.now();
  const pollSeconds = Number(args['poll-seconds']);
  const timeoutSeconds = Number(args['timeout-seconds']);
  const requestTimeout = Number(args['request-timeout-seconds']);
  for (const value of [pollSeconds, timeoutSeconds, requestTimeout])
    if (!Number.isFinite(value) || value <= 0)
      throw new WorkflowError('Timeouts and polling interval must be finite and positive');
  if (args['max-credits'] !== undefined && !/^\d+$/.test(args['max-credits']))
    throw new WorkflowError('max-credits must contain a non-negative integer');
  const maxCredits =
    args['max-credits'] === undefined
      ? undefined
      : integer(Number(args['max-credits']), 'max-credits');
  if (args['approve-build'] && maxCredits === undefined)
    throw new WorkflowError('--approve-build requires an explicit --max-credits ceiling');
  if (!args.state) throw new WorkflowError('--state is required for safe recovery');
  const paths = [
    resolve(args.state),
    resolve(args.output),
    ...(args.receipt ? [resolve(args.receipt)] : []),
  ];
  if (new Set(paths).size !== paths.length)
    throw new WorkflowError('Checkpoint, output and receipt paths must differ');
  if (existsSync(args.output) || (args.receipt && existsSync(args.receipt)))
    throw new WorkflowError('Output or receipt already exists; choose a new path before starting');
  const endpoint = new URL(args['base-url']);
  if (
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname !== '/'
  )
    throw new WorkflowError('base-url must be a trusted API origin, without credentials or a path');
  if (
    endpoint.protocol !== 'https:' &&
    !(
      args['allow-local-http'] &&
      endpoint.protocol === 'http:' &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)
    )
  )
    throw new WorkflowError('HTTPS required; local HTTP requires --allow-local-http');
  const origin = endpoint.origin;
  const token = process.env.EASYRENDER_API_KEY;
  if (!token || !/^[!-~]+$/.test(token))
    throw new WorkflowError('Set EASYRENDER_API_KEY in the environment');
  const deadline = started + timeoutSeconds * 1000;
  function remaining() {
    const seconds = (deadline - performance.now()) / 1000;
    if (seconds <= 0) throw new WorkflowError('Workflow timeout; resume the saved render ID');
    return seconds;
  }
  async function pause(seconds: number) {
    if (seconds >= remaining())
      throw new WorkflowError('Retry/poll delay exceeds workflow deadline; resume later');
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }
  async function request(
    method: string,
    path: string,
    body?: BodyInit,
    contentType?: string,
    headers: Record<string, string> = {},
    isModel = false,
  ): Promise<Json | Uint8Array> {
    if (!path.startsWith('/api/') || path.startsWith('//'))
      throw new WorkflowError('Refusing an untrusted API path');
    for (let attempt = 0; attempt < 3; attempt++) {
      let response: Response;
      let bytes: Uint8Array;
      try {
        const signal = AbortSignal.timeout(
          Math.max(1, Math.floor(Math.min(requestTimeout, remaining()) * 1000)),
        );
        response = await fetch(origin + path, {
          method,
          body,
          redirect: 'manual',
          signal,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: isModel ? 'model/gltf-binary' : 'application/json',
            ...(contentType ? { 'Content-Type': contentType } : {}),
            ...headers,
          },
        });
        if (response.status >= 300 && response.status < 400) {
          await response.body?.cancel();
          throw new WorkflowError('Redirect refused; credentials are never forwarded');
        }
        const chunks: Uint8Array[] = [];
        let size = 0;
        const limit = isModel ? MAX_MODEL : 1024 * 1024;
        if (response.body) {
          const reader = response.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > limit) {
              await reader.cancel();
              throw new WorkflowError('Response exceeded the size limit');
            }
            chunks.push(value);
          }
        }
        bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
      } catch (error) {
        if (error instanceof WorkflowError) throw error;
        throw new WorkflowError(
          'Request failed or timed out; no mutation was retried. Resume the saved ID',
        );
      }
      if (method === 'GET' && [429, 502, 503, 504].includes(response.status) && attempt < 2) {
        const delay = Number(response.headers.get('retry-after') ?? String(2 ** attempt));
        if (!Number.isFinite(delay) || delay < 0)
          throw new WorkflowError('Non-numeric Retry-After; stop and retry later');
        await pause(delay);
        continue;
      }
      if (!response.ok) {
        const correlation = response.headers.get('x-request-id') ?? '';
        const suffix = /^[0-9a-fA-F-]{36}$/.test(correlation) ? ` (request_id=${correlation})` : '';
        throw new WorkflowError(
          `HTTP ${response.status}${suffix}; inspect the saved job before retrying any mutation`,
        );
      }
      if (isModel) {
        if (
          response.headers.get('content-type')?.split(';')[0].toLowerCase() !== 'model/gltf-binary'
        )
          throw new WorkflowError('Expected a GLB response');
        return bytes;
      }
      try {
        return object(JSON.parse(new TextDecoder().decode(bytes)));
      } catch {
        throw new WorkflowError('Invalid JSON object response');
      }
    }
    throw new WorkflowError('Read retry limit reached');
  }
  const get = async (path: string) => object(await request('GET', path));
  const post = async (path: string, value: Json, headers?: Record<string, string>) =>
    object(await request('POST', path, JSON.stringify(value), 'application/json', headers));
  const statePath = args.state;
  const lockPath = `${statePath}.lock`;
  try {
    writeFileSync(lockPath, '', { flag: 'wx', mode: 0o600 });
  } catch {
    throw new WorkflowError(
      'Checkpoint locked or inaccessible; inspect before removing a stale .lock',
    );
  }
  try {
    const isResumed = existsSync(statePath) || args['render-id'] !== undefined;
    const state: Json = existsSync(statePath)
      ? object(JSON.parse(readFileSync(statePath, 'utf8')))
      : { version: 1, origin };
    if (state.version !== 1 || state.origin !== origin)
      throw new WorkflowError('Checkpoint belongs to another API origin or format');
    if (args['render-id']) {
      if (state.renderId && state.renderId !== args['render-id'])
        throw new WorkflowError('Render ID differs from checkpoint');
      state.renderId = identifier(args['render-id']);
    }
    if (!state.renderId) {
      const key = args['idempotency-key'] ?? state.idempotencyKey;
      if (typeof key !== 'string' || !/^[!-~]{1,128}$/.test(key))
        throw new WorkflowError('A stable --idempotency-key is required for one preview');
      if (state.idempotencyKey && state.idempotencyKey !== key)
        throw new WorkflowError('Do not change a checkpoint idempotency key');
      if (!args.image) throw new WorkflowError('--image is required until a render ID is saved');
      const suffix = extname(args.image).toLowerCase();
      const mime: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
      };
      const size = statSync(args.image).size;
      if (!mime[suffix] || size <= 0 || size > MAX_IMAGE)
        throw new WorkflowError('Use one JPEG, PNG or WebP photo of at most 4 MiB');
      const bytes = readFileSync(args.image);
      const digest = createHash('sha256').update(bytes).digest('hex');
      if (state.imageSha256 && state.imageSha256 !== digest)
        throw new WorkflowError('Photo differs from the checkpoint; do not reuse its creation key');
      Object.assign(state, { idempotencyKey: key, imageSha256: digest });
      save(statePath, state);
      if (!state.uploadId) {
        const form = new FormData();
        form.set('image', new Blob([bytes], { type: mime[suffix] }), `photo${suffix}`);
        state.uploadId = identifier(object(await request('POST', '/api/uploads', form)).id);
        save(statePath, state);
      }
      const preview = await post(
        '/api/renders',
        { upload_id: identifier(state.uploadId), isPublic: false },
        { 'Idempotency-Key': key },
      );
      state.renderId = identifier(preview.id);
    }
    const id = identifier(state.renderId);
    save(statePath, state);
    const path = `/api/renders/${encodeURIComponent(id)}`;
    emit({ renderId: id, checkpoint: statePath });
    let render: Json;
    while (true) {
      render = await get(path);
      if (render.id !== id) throw new WorkflowError('Render ID mismatch');
      if (render.status === 'ready') {
        if (render.hasModel !== true)
          throw new WorkflowError('Ready render has no model; inspect the existing ID');
        break;
      }
      if (render.status === 'failed')
        throw new WorkflowError('Render failed; this example will not create a replacement');
      if (render.status === 'preview_ready') {
        const pending = Math.max(
          0,
          integer(render.renderCredits, 'renderCredits') - integer(render.credits, 'credits'),
        );
        const pricing = await get('/api/credits');
        const balance = integer(pricing.balance, 'balance');
        if (!['usd', 'eur'].includes(String(pricing.currency)))
          throw new WorkflowError('Unsupported quote currency');
        emit({ pendingCredits: pending, balance, currency: pricing.currency });
        if (!args['approve-build']) {
          emit(
            'Preview ready. Inspect it in your account; rerun this checkpoint with --approve-build --max-credits N to authorize a build.',
          );
          return;
        }
        if (maxCredits === undefined || pending > maxCredits || pending > balance)
          throw new WorkflowError(
            'Budget or balance is below the quoted pending debit; no build submitted',
          );
        if (state.buildAttempted)
          throw new WorkflowError(
            'A build was already attempted. Its outcome must be resolved; this example will not resubmit',
          );
        Object.assign(state, {
          buildAttempted: true,
          authorizedMaxCredits: maxCredits,
          quotedPendingCredits: pending,
        });
        save(statePath, state);
        await post(`${path}/render`, { maxCredits });
      } else if (!['drafting', 'rendering'].includes(String(render.status)))
        throw new WorkflowError('Unknown render status; stopping without spending');
      await pause(pollSeconds);
    }
    const observedRenderCredits = integer(render.credits, 'credits');
    const bytes = await request('GET', `${path}/model`, undefined, undefined, {}, true);
    if (!(bytes instanceof Uint8Array) || bytes.byteLength < 12)
      throw new WorkflowError('Downloaded body is not a complete GLB 2.0 file');
    const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (
      header.getUint32(0, true) !== 0x46546c67 ||
      header.getUint32(4, true) !== 2 ||
      header.getUint32(8, true) !== bytes.byteLength
    )
      throw new WorkflowError('Downloaded body is not a complete GLB 2.0 file');
    writeFileSync(args.output, bytes, { flag: 'wx', mode: 0o600 });
    const receipt = {
      renderId: id,
      status: 'ready',
      glbBytes: bytes.byteLength,
      observedRenderCredits,
      authorizedMaxCredits: state.authorizedMaxCredits ?? null,
      quotedPendingCredits: state.quotedPendingCredits ?? null,
      invocationSeconds: Math.round(performance.now() - started) / 1000,
      isResumed,
      timingScope: 'this_invocation',
    };
    if (args.receipt)
      writeFileSync(args.receipt, JSON.stringify(receipt), { flag: 'wx', mode: 0o600 });
    emit(receipt);
  } finally {
    unlinkSync(lockPath);
  }
}
main().catch((error) => {
  process.stderr.write(
    `${error instanceof WorkflowError ? error.message : 'Local file/checkpoint, arguments or response error; inspect the saved ID'}\n`,
  );
  process.exitCode = 1;
});
