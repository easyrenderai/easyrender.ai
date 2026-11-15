// Thin Replicate REST client. Serverless friendly: it starts predictions and reads them back,
// it never waits for one to finish inside a request. The caller polls or receives a webhook.

const API = 'https://api.replicate.com/v1';
const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 10_000;
const REQUEST_BUDGET_MS = 45_000;

// A failed POST response can mean the provider accepted the job but lost its reply. Callers
// must not turn that uncertainty into another paid prediction.
export class ProviderRequestError extends Error {
  constructor(
    message: string,
    readonly isAmbiguous: boolean,
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createReplicate(token: string, fetchImpl: typeof fetch = fetch) {
  if (!token) throw new Error('REPLICATE_API_TOKEN is not set');

  const deadline = Date.now() + REQUEST_BUDGET_MS;
  // GET is safe to retry; a rejected 429 can also be retried. Never replay an uncertain POST.
  async function api<T>(path: string, init: RequestInit = {}, attempt = 0): Promise<T> {
    const isRead = !init.method || init.method === 'GET';
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new ProviderRequestError('Provider request deadline exceeded', false);
    let response: Response;
    try {
      response = await fetchImpl(`${API}${path}`, {
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
      await response.body?.cancel();
      throw new ProviderRequestError(
        `Replicate ${init.method ?? 'GET'} ${path}: ${response.status}`,
        !isRead && (response.status >= 500 || response.status === 408),
      );
    }
    try {
      return (await response.json()) as T;
    } catch {
      throw new ProviderRequestError('Provider returned an unreadable response', !isRead);
    }
  }

  return {
    // Uploads bytes to Replicate's file store and returns a URL that predictions can read.
    async upload(bytes: Uint8Array, filename: string, contentType: string): Promise<string> {
      const form = new FormData();
      form.append('content', new Blob([bytes as BlobPart], { type: contentType }), filename);
      const file = await api<{ urls: { get: string } }>('/files', { method: 'POST', body: form });
      return file.urls.get;
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
