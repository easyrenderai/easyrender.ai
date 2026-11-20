// A local stand-in for the Replicate API, for the paid-flow test only. It answers the three calls
// the app makes (start a prediction, read one back, fetch its output file), returns a valid angle
// sheet and a valid GLB, and records every request so the test can assert what was sent.
// The app reaches it through REPLICATE_API_BASE_URL, which the harness refuses in production.
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { MOCK_ORIGIN, MOCK_PORT, MOCK_TOKEN } from './endpoints';
import { minimalGlb } from './glb';
import { angleSheet } from './png';

// A prediction reads "processing" for this long, so the app's polling is exercised.
const DELAY_MS = 600;

type Kind = 'sheet' | 'build';
type Prediction = { id: string; kind: Kind; createdAt: number };
export type MockRequest = { method: string; path: string; kind?: Kind; imageCount?: number };

const predictions = new Map<string, Prediction>();
const requests: MockRequest[] = [];
const sheet = angleSheet();
const glb = minimalGlb();

function readBody(request: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function countImages(body: unknown): number {
  const input = (body as { input?: Record<string, unknown> } | null)?.input ?? {};
  for (const value of Object.values(input)) {
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      const images = value.filter((item) => item.startsWith('data:image/'));
      if (images.length) return images.length;
    }
    // A model that takes one picture (TRELLIS.2) gets a single data URL.
    if (typeof value === 'string' && value.startsWith('data:image/')) return 1;
  }
  return 0;
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', MOCK_ORIGIN);
  const origin = MOCK_ORIGIN;
  const json = (status: number, body: unknown) => {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  };

  if (url.pathname === '/__requests') return json(200, requests);
  if (url.pathname === '/__reset') {
    requests.length = 0;
    predictions.clear();
    return json(200, {});
  }
  if (url.pathname === '/__health') return json(200, { ok: true });

  if (url.pathname.startsWith('/files/')) {
    const isSheet = url.pathname.endsWith('.png');
    response.writeHead(200, { 'content-type': isSheet ? 'image/png' : 'model/gltf-binary' });
    return void response.end(isSheet ? sheet : glb);
  }

  if (request.headers.authorization !== `Bearer ${MOCK_TOKEN}`) {
    return json(401, { detail: 'Unauthenticated' });
  }

  if (request.method === 'POST' && /^\/v1\/(models\/.+\/)?predictions$/.test(url.pathname)) {
    const body = JSON.parse((await readBody(request)) || '{}') as unknown;
    // Sheet drawings go to /models/<owner>/<model>/predictions; the 3D build to /predictions.
    const kind: Kind = url.pathname.startsWith('/v1/models/') ? 'sheet' : 'build';
    // Ids stay unique across resets, like Replicate's: the app stores them under a unique index.
    const id = `mock-${kind}-${randomUUID()}`;
    predictions.set(id, { id, kind, createdAt: Date.now() });
    requests.push({
      method: 'POST',
      path: url.pathname,
      kind,
      imageCount: countImages(body),
    });
    return json(201, { id, status: 'starting' });
  }

  const read = /^\/v1\/predictions\/([^/]+)$/.exec(url.pathname);
  if (request.method === 'GET' && read) {
    const prediction = predictions.get(read[1] as string);
    if (!prediction) return json(404, { detail: 'Not found' });
    requests.push({ method: 'GET', path: url.pathname, kind: prediction.kind });
    if (Date.now() - prediction.createdAt < DELAY_MS) {
      return json(200, { id: prediction.id, status: 'processing' });
    }
    return json(200, {
      id: prediction.id,
      status: 'succeeded',
      output:
        prediction.kind === 'sheet'
          ? [`${origin}/files/${prediction.id}.png`]
          : { model_file: `${origin}/files/${prediction.id}.glb` },
      metrics: { predict_time: 1 },
    });
  }

  return json(404, { detail: `Unhandled ${request.method} ${url.pathname}` });
}).listen(MOCK_PORT, '127.0.0.1', () => {
  process.stdout.write(`replicate mock on ${MOCK_ORIGIN}\n`);
});
