// Thin Replicate REST client. Serverless friendly: it starts predictions and reads them back,
// it never waits for one to finish inside a request. The caller polls or receives a webhook.

import sharp from 'sharp';

const DEFAULT_API = 'https://api.replicate.com/v1';
const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 10_000;
const REQUEST_BUDGET_MS = 45_000;

// A failed POST response can mean the provider accepted the job but lost its reply. Callers
// must not turn that uncertainty into another paid prediction.
export class ProviderRequestError extends Error {
  constructor(
    message: string,
    readonly isAmbiguous: boolean,
    // The HTTP status when Replicate answered; undefined when no response arrived at all.
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ProviderRequestError';
  }
}

export type PredictionStatus = 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';

export type Prediction = {
  id: string;
  status: PredictionStatus;
  error?: string | null;
  output?: unknown;
  metrics?: { predict_time?: number };
};

export type ReplicateClient = ReturnType<typeof createReplicate>;

const AUTH_STATUSES = new Set([401, 402, 403]);
const ERROR_DETAIL_CHARS = 300;

// Replicate explains a failure in the body ({"detail": "..."}). Keep a short, single-line copy so
// logs say why; the body never carries our token.
async function errorDetail(response: Response): Promise<string> {
  try {
    const text = (await response.text()).replace(/\s+/g, ' ').trim();
    return text ? ` - ${text.slice(0, ERROR_DETAIL_CHARS)}` : '';
  } catch {
    return '';
  }
}

// Replicate answers 500 to any prediction whose image input is a URL (verified against both
// nano-banana models, with its own file URLs and public ones), so images travel inline as data URIs.
// Anything bigger than this is re-encoded first to keep the request body small.
const INLINE_MAX_BYTES = 3 * 1024 * 1024;
const INLINE_MAX_EDGE = 2048;

export async function toDataUri(bytes: Uint8Array, contentType: string): Promise<string> {
  if (bytes.byteLength <= INLINE_MAX_BYTES) {
    return `data:${contentType};base64,${Buffer.from(bytes).toString('base64')}`;
  }
  const jpeg = await sharp(bytes)
    .rotate()
    .resize(INLINE_MAX_EDGE, INLINE_MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 90 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Test and CI only: REPLICATE_API_BASE_URL points the client at a local mock so a browser test
// can run the paid flow without spending real money. It is refused wherever real customers
// are served, so a stray variable can never redirect production traffic (or its token).
// harness cannot import core's config, so this repeats `config.isProduction()`.
export function replicateBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.REPLICATE_API_BASE_URL?.trim();
  if (!override) return DEFAULT_API;
  const isProduction =
    env.VERCEL_ENV === 'production' ||
    (env.NODE_ENV === 'production' && env.VERCEL_ENV !== 'preview');
  if (isProduction) {
    throw new Error('REPLICATE_API_BASE_URL is not allowed in production');
  }
  let url: URL;
  try {
    url = new URL(override);
  } catch {
    throw new Error('REPLICATE_API_BASE_URL is not a valid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('REPLICATE_API_BASE_URL must be an http or https URL');
  }
  // Trim trailing slashes by hand: a regex on environment input is flagged as backtracking.
  let end = override.length;
  while (end > 0 && override[end - 1] === '/') end--;
  return override.slice(0, end);
}

export function createReplicate(token: string, fetchImpl: typeof fetch = fetch) {
  if (!token) throw new Error('REPLICATE_API_TOKEN is not set');
  const apiBase = replicateBaseUrl();

  const deadline = Date.now() + REQUEST_BUDGET_MS;
  // GET is safe to retry; a rejected 429 can also be retried. Never replay an uncertain POST.
  async function api<T>(path: string, init: RequestInit = {}, attempt = 0): Promise<T> {
    const isRead = !init.method || init.method === 'GET';
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new ProviderRequestError('Provider request deadline exceeded', false);
    let response: Response;
    try {
      response = await fetchImpl(`${apiBase}${path}`, {
        ...init,
        signal: AbortSignal.timeout(Math.min(remaining, REQUEST_TIMEOUT_MS)),
        headers: { Authorization: `Bearer ${token}`, ...init.headers },
      });
    } catch {
      throw new ProviderRequestError(
        `Replicate ${init.method ?? 'GET'} ${path} did not return a response`,
        !isRead,
      );
    }
    const canRetry = response.status === 429 || (isRead && response.status >= 500);
    if (canRetry && attempt < MAX_ATTEMPTS - 1) {
      const retryAfter = Number(response.headers.get('retry-after')) || 2 ** attempt;
      const wait = Math.max(0, Math.min(retryAfter, 5)) * 1000;
      if (Date.now() + wait < deadline) {
        await response.body?.cancel();
        await sleep(wait);
        return api<T>(path, init, attempt + 1);
      }
    }
    if (!response.ok) {
      const detail = await errorDetail(response);
      const call = `Replicate ${init.method ?? 'GET'} ${path}: ${response.status}`;
      // A bad, unfunded or forbidden token is definite and will not fix itself: fail fast.
      if (AUTH_STATUSES.has(response.status)) {
        throw new ProviderRequestError(
          `${call} (the API token or billing was rejected)${detail}`,
          false,
          response.status,
        );
      }
      throw new ProviderRequestError(
        `${call}${detail}`,
        !isRead && (response.status >= 500 || response.status === 408),
        response.status,
      );
    }
    try {
      return (await response.json()) as T;
    } catch {
      throw new ProviderRequestError('Provider returned an unreadable response', !isRead);
    }
  }

  return {
    // Returns an image reference a prediction can read. It is a data URI, never a URL: see
    // toDataUri. The filename is unused and kept so callers did not change.
    async upload(bytes: Uint8Array, _filename: string, contentType: string): Promise<string> {
      return toDataUri(bytes, contentType);
    },

    async start(path: string, body: unknown, webhook?: string): Promise<Prediction> {
      const payload = webhook
        ? { ...(body as object), webhook, webhook_events_filter: ['completed'] }
        : body;
      return api<Prediction>(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },

    get: (id: string) => api<Prediction>(`/predictions/${id}`),
    cancel: (id: string) => api<Prediction>(`/predictions/${id}/cancel`, { method: 'POST' }),
  };
}

export const isSettled = (status: PredictionStatus) =>
  status === 'succeeded' || status === 'failed' || status === 'canceled';

// TRELLIS nests its outputs; the GLB is wherever a .glb URL appears.
export function findGlbUrl(output: unknown): string | null {
  if (typeof output === 'string') return /\.glb(\?|$)/i.test(output) ? output : null;
  if (Array.isArray(output)) return output.map(findGlbUrl).find(Boolean) ?? null;
  if (output && typeof output === 'object') {
    return Object.values(output).map(findGlbUrl).find(Boolean) ?? null;
  }
  return null;
}

export async function download(url: string, fetchImpl: typeof fetch = fetch): Promise<Uint8Array> {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`download ${url}: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}
