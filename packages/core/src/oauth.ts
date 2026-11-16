import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { redeemOAuthApiKey } from './api-keys';
import { config } from './config';
import { AppError } from './errors';

// OAuth 2.1 for MCP clients such as claude.ai: dynamic client registration, authorization code
// with PKCE, and a token endpoint. Client registrations and short-lived codes are signed;
// redemption is persisted atomically with the API key so a code can be used only once.

const CODE_TTL_S = 120;
const CLIENT_TTL_S = 60 * 60 * 24 * 365;
const MAX_REDIRECTS = 10;

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) throw new AppError('OAuth is not configured', 500, 'oauth_config');
  return value;
}

const b64 = (value: string | Buffer) => Buffer.from(value).toString('base64url');
const mac = (data: string) => createHmac('sha256', secret()).update(data).digest();

function sign(payload: Record<string, unknown>): string {
  const body = b64(JSON.stringify(payload));
  return `${body}.${b64(mac(body))}`;
}

function verify<T>(token: string, type: string): (T & { exp: number }) | null {
  const parts = token.split('.');
  const [body, signature] = parts;
  if (parts.length !== 2 || !body || !signature) return null;
  // Compare the encoded strings: decoding would accept non-canonical trailing characters.
  const expected = Buffer.from(b64(mac(body)));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as {
      t: string;
      exp: number;
    };
    if (payload.t !== type || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload as unknown as T & { exp: number };
  } catch {
    return null;
  }
}

const now = () => Math.floor(Date.now() / 1000);

// Native clients use loopback http; everything else must be https. No fragments.
export function isAllowedRedirect(uri: string): boolean {
  try {
    const url = new URL(uri);
    if (url.hash) return false;
    if (url.protocol === 'https:') return true;
    return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

export type OAuthClient = { id: string; name: string; redirectUris: string[] };

// RFC 7591. The client id carries the registration, signed, so we store nothing.
export function registerClient(input: { client_name?: unknown; redirect_uris?: unknown }) {
  const uris = Array.isArray(input.redirect_uris) ? input.redirect_uris : [];
  if (
    uris.length === 0 ||
    uris.length > MAX_REDIRECTS ||
    !uris.every((u) => typeof u === 'string' && isAllowedRedirect(u))
  ) {
    throw new AppError(
      'redirect_uris must be https (or loopback http) URLs',
      400,
      'invalid_redirect_uri',
    );
  }
  const name =
    typeof input.client_name === 'string' && input.client_name.trim()
      ? input.client_name.trim().slice(0, 60)
      : 'MCP client';
  const issued = now();
  return {
    client_id: sign({ t: 'client', name, uris, exp: issued + CLIENT_TTL_S }),
    client_id_issued_at: issued,
    client_name: name,
    redirect_uris: uris,
    grant_types: ['authorization_code'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  };
}

export function readClient(clientId: string | null | undefined): OAuthClient | null {
  if (!clientId) return null;
  const payload = verify<{ name: string; uris: string[] }>(clientId, 'client');
  return payload ? { id: clientId, name: payload.name, redirectUris: payload.uris } : null;
}

export type AuthorizeRequest = {
  client: OAuthClient;
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
  isRedirectRequired: boolean;
  resource: string;
};

// A token issued here is for this easyrender service (including its authenticated asset URLs).
// Older MCP clients omit resource; they keep working with the sole canonical audience.
function requestedResource(resource: string | null | undefined): string {
  const canonical = `${config.appUrl()}/api/mcp`;
  if (resource != null && resource !== canonical) {
    throw new AppError('Requested resource is not supported', 400, 'invalid_target');
  }
  return canonical;
}

// Validates an /authorize request. Errors here must NOT redirect: the redirect URI is untrusted.
export function parseAuthorizeRequest(params: URLSearchParams): AuthorizeRequest {
  const client = readClient(params.get('client_id'));
  if (!client) throw new AppError('Unknown client', 400, 'invalid_client');
  const redirectUri =
    params.get('redirect_uri') ??
    (client.redirectUris.length === 1 ? client.redirectUris[0] : null);
  if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
    throw new AppError('redirect_uri does not match the registration', 400, 'invalid_redirect_uri');
  }
  if (params.get('response_type') !== 'code') {
    throw new AppError('Only response_type=code is supported', 400, 'unsupported_response_type');
  }
  const codeChallenge = params.get('code_challenge');
  if (
    !codeChallenge ||
    !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge) ||
    params.get('code_challenge_method') !== 'S256'
  ) {
    throw new AppError('PKCE with code_challenge_method=S256 is required', 400, 'invalid_request');
  }
  if (params.getAll('resource').length > 1) {
    throw new AppError('Only one resource is supported', 400, 'invalid_target');
  }
  return {
    client,
    redirectUri,
    state: params.get('state'),
    codeChallenge,
    isRedirectRequired: params.has('redirect_uri'),
    resource: requestedResource(params.get('resource')),
  };
}

export function redirectWith(redirectUri: string, params: Record<string, string | null>): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params))
    if (value !== null) url.searchParams.set(key, value);
  return url.toString();
}

// The user approved: mint a short-lived signed code bound to the client, redirect and PKCE challenge.
export function issueCode(request: AuthorizeRequest, userId: string): string {
  return sign({
    t: 'code',
    cid: request.client.id,
    uid: userId,
    ru: request.redirectUri,
    ch: request.codeChallenge,
    rr: request.isRedirectRequired,
    resource: request.resource,
    n: b64(randomBytes(8)),
    exp: now() + CODE_TTL_S,
  });
}

export async function exchangeCode(input: {
  code: string | null;
  clientId: string | null;
  redirectUri: string | null;
  codeVerifier: string | null;
  resource?: string | null;
}) {
  const grantError = (message: string) => new AppError(message, 400, 'invalid_grant');
  const client = readClient(input.clientId);
  if (!client) throw new AppError('Unknown client', 401, 'invalid_client');
  const payload = input.code
    ? verify<{ cid: string; uid: string; ru: string; ch: string; rr?: boolean; resource?: string }>(
        input.code,
        'code',
      )
    : null;
  if (!payload) throw grantError('Invalid or expired code');
  if (payload.cid !== client.id) throw grantError('Code was issued to another client');
  if ((payload.rr !== false || input.redirectUri != null) && input.redirectUri !== payload.ru)
    throw grantError('redirect_uri mismatch');
  if (!input.codeVerifier || !/^[A-Za-z0-9._~-]{43,128}$/.test(input.codeVerifier))
    throw grantError('A valid PKCE code_verifier is required');
  const challenge = createHash('sha256').update(input.codeVerifier).digest('base64url');
  if (challenge !== payload.ch) throw grantError('PKCE verification failed');

  const resource = requestedResource(input.resource);
  if (payload.resource != null && resource !== payload.resource)
    throw grantError('resource mismatch');
  const accessToken = await redeemOAuthApiKey({
    codeHash: createHash('sha256')
      .update(input.code as string)
      .digest('hex'),
    userId: payload.uid,
    name: `${client.name} (OAuth)`,
    expiresAt: new Date(payload.exp * 1000),
    resource,
  });
  return { access_token: accessToken, token_type: 'Bearer' as const };
}

// Metadata documents (RFC 9728 and RFC 8414).
export function protectedResourceMetadata() {
  const base = config.appUrl();
  return {
    resource: `${base}/api/mcp`,
    authorization_servers: [base],
    bearer_methods_supported: ['header'],
    resource_name: 'easyrender',
  };
}

export function authorizationServerMetadata() {
  const base = config.appUrl();
  return {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  };
}

export const resourceMetadataUrl = () =>
  `${config.appUrl()}/.well-known/oauth-protected-resource/api/mcp`;
