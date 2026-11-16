import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
import { AppError } from './errors';
import { IMAGE_TYPES, MAX_UPLOAD_BYTES } from './renders';

const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 15_000;

// Permit global unicast only. IPv4-mapped IPv6 is normalized before checking so hex forms
// such as ::ffff:7f00:1 cannot disguise loopback; transition networks are deliberately excluded.
export function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const normalized = new URL(`https://[${address}]/`).hostname.slice(1, -1).toLowerCase();
    if (normalized.startsWith('::ffff:')) {
      const words = normalized.slice(7).split(':');
      if (words.length !== 2) return true;
      const value = words.map((word) => Number.parseInt(word, 16));
      return isPrivateAddress(
        `${(value[0] ?? 0) >>> 8}.${(value[0] ?? 0) & 255}.${(value[1] ?? 0) >>> 8}.${(value[1] ?? 0) & 255}`,
      );
    }
    return (
      !/^[23][0-9a-f]{3}:/.test(normalized) ||
      normalized.startsWith('2002:') ||
      normalized.startsWith('2001:db8:') ||
      normalized.startsWith('2001::') ||
      normalized.startsWith('2001:0:') ||
      normalized.startsWith('2001:2:') ||
      normalized.startsWith('2001:10:') ||
      normalized.startsWith('2001:20:')
    );
  }
  if (isIP(address) !== 4) return true;
  const [a = 0, b = 0, c = 0] = address.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0)) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

const badUrl = () => new AppError('Could not fetch a public image', 400, 'bad_url');
const tooLarge = () => new AppError('Photo is larger than 4 MiB', 413, 'too_large');

async function publicAddress(url: URL, signal: AbortSignal): Promise<string> {
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443'))
    throw badUrl();
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const resolving = isIP(host) ? Promise.resolve([{ address: host }]) : lookup(host, { all: true });
  const addresses = await new Promise<Array<{ address: string }>>((resolve, reject) => {
    const abort = () => reject(badUrl());
    if (signal.aborted) return abort();
    signal.addEventListener('abort', abort, { once: true });
    resolving.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address)))
    throw badUrl();
  return addresses[0]?.address ?? '';
}

type Download = { redirect: string } | { bytes: Uint8Array; contentType: string };

function downloadPinned(url: URL, address: string, signal: AbortSignal): Promise<Download> {
  return new Promise((resolve, reject) => {
    const host = url.hostname.replace(/^\[|\]$/g, '');
    // Connect to exactly the address checked above. SNI, certificate verification and Host
    // still use the requested hostname; no second DNS lookup can rebind it to a private IP.
    const outgoing = request(
      {
        protocol: 'https:',
        hostname: address,
        port: 443,
        servername: isIP(host) ? undefined : host,
        method: 'GET',
        path: `${url.pathname}${url.search}`,
        headers: {
          host: url.host,
          accept: 'image/jpeg,image/png,image/webp',
          'accept-encoding': 'identity',
        },
        signal,
        agent: false,
      },
      (incoming) => {
        const status = incoming.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          const location = incoming.headers.location;
          incoming.destroy();
          if (location) resolve({ redirect: location });
          else reject(badUrl());
          return;
        }
        const contentType =
          incoming.headers['content-type']?.split(';')[0]?.trim().toLowerCase() ?? '';
        if (status < 200 || status >= 300 || !IMAGE_TYPES.has(contentType)) {
          incoming.destroy();
          reject(
            status >= 200 && status < 300
              ? new AppError('Upload a JPEG, PNG or WebP photo', 415, 'bad_type')
              : badUrl(),
          );
          return;
        }
        if (Number(incoming.headers['content-length'] ?? 0) > MAX_UPLOAD_BYTES) {
          incoming.destroy();
          reject(tooLarge());
          return;
        }
        const chunks: Buffer[] = [];
        let length = 0;
        incoming.on('data', (chunk: Buffer) => {
          length += chunk.byteLength;
          if (length > MAX_UPLOAD_BYTES) {
            incoming.destroy();
            reject(tooLarge());
            return;
          }
          chunks.push(chunk);
        });
        incoming.on('end', () =>
          resolve({ bytes: new Uint8Array(Buffer.concat(chunks, length)), contentType }),
        );
        incoming.on('error', () => reject(badUrl()));
        incoming.on('aborted', () => reject(badUrl()));
      },
    );
    outgoing.on('error', () => reject(badUrl()));
    outgoing.end();
  });
}

// One deadline covers DNS, all redirects, TLS and body reads. Neither headers nor a changing
// DNS answer can bypass the byte/address checks. There is no provider or customer credential here.
export async function fetchRemoteImage(
  rawUrl: string,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  try {
    let url = new URL(rawUrl);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const address = await publicAddress(url, signal);
      const result = await downloadPinned(url, address, signal);
      if ('bytes' in result) return result;
      url = new URL(result.redirect, url);
    }
    throw badUrl();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw badUrl();
  }
}
