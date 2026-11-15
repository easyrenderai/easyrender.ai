import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

process.env.BETTER_AUTH_SECRET = 'test-secret-test-secret-test-secret';

const redemptions = vi.hoisted(() => new Set<string>());
vi.mock('./api-keys', () => ({
  ensureApiKey: vi.fn(async () => {}),
  redeemOAuthApiKey: async (input: { codeHash: string }) => {
    if (redemptions.has(input.codeHash)) throw new Error('Authorization code already used');
    redemptions.add(input.codeHash);
    return `er_${input.codeHash}`;
  },
}));

const { exchangeCode, issueCode, parseAuthorizeRequest, readClient, registerClient } = await import(
  './oauth'
);

const REDIRECT = 'https://claude.ai/api/mcp/auth_callback';
const verifier = 'v'.repeat(64);
const challenge = createHash('sha256').update(verifier).digest('base64url');

function authorize(clientId: string, extra: Record<string, string> = {}) {
  return parseAuthorizeRequest(
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT,
      response_type: 'code',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      ...extra,
    }),
  );
}

afterEach(() => {
  vi.useRealTimers();
  redemptions.clear();
});

describe('client registration', () => {
  it('round-trips a signed client id', () => {
    const { client_id } = registerClient({ client_name: 'Claude', redirect_uris: [REDIRECT] });
    expect(readClient(client_id)).toMatchObject({ name: 'Claude', redirectUris: [REDIRECT] });
  });

  it('rejects insecure or missing redirect URIs', () => {
    for (const redirect_uris of [
      [],
      ['http://evil.com/cb'],
      ['javascript:alert(1)'],
      ['https://a.com/#x'],
      'nope',
    ]) {
      expect(() => registerClient({ redirect_uris })).toThrow();
    }
    expect(() => registerClient({ redirect_uris: ['http://localhost:6274/cb'] })).not.toThrow();
  });

  it('rejects a client id that was tampered with', () => {
    const { client_id } = registerClient({ redirect_uris: [REDIRECT] });
    const [body, sig] = client_id.split('.');
    const forged = Buffer.from(
      JSON.stringify({ t: 'client', name: 'x', uris: ['https://evil.com/'], exp: 9e9 }),
    ).toString('base64url');
    expect(readClient(`${forged}.${sig}`)).toBeNull();
    expect(readClient(`${body}.${sig}x`)).toBeNull();
  });
});

describe('authorize request', () => {
  const { client_id } = registerClient({ redirect_uris: [REDIRECT] });

  it('requires a registered redirect, S256 PKCE and response_type=code', () => {
    expect(authorize(client_id).redirectUri).toBe(REDIRECT);
    expect(() => authorize(client_id, { redirect_uri: 'https://evil.com/cb' })).toThrow();
    expect(() => authorize(client_id, { code_challenge_method: 'plain' })).toThrow();
    expect(() => authorize(client_id, { response_type: 'token' })).toThrow();
    expect(() => authorize('garbage')).toThrow();
  });
});

it('rejects another resource at authorization', () => {
  const { client_id } = registerClient({ redirect_uris: [REDIRECT] });
  expect(() => authorize(client_id, { resource: 'https://other.example/api' })).toThrow(/resource/);
});

it('requires a valid S256 challenge', () => {
  const { client_id } = registerClient({ redirect_uris: [REDIRECT] });
  expect(() => authorize(client_id, { code_challenge: 'short' })).toThrow(/PKCE/);
});

describe('code exchange', () => {
  const { client_id } = registerClient({ redirect_uris: [REDIRECT] });
  const exchange = (code: string, over: Partial<Parameters<typeof exchangeCode>[0]> = {}) =>
    exchangeCode({
      code,
      clientId: client_id,
      redirectUri: REDIRECT,
      codeVerifier: verifier,
      ...over,
    });

  it('issues one token and rejects code replay', async () => {
    const code = issueCode(authorize(client_id), 'user_1');
    const first = await exchange(code);
    expect(first.access_token).toMatch(/^er_/);
    await expect(exchange(code)).rejects.toThrow(/already used/);
    expect((await exchange(issueCode(authorize(client_id), 'user_1'))).access_token).not.toBe(
      first.access_token,
    );
  });

  it('fails on a wrong verifier, redirect, client or tampered code', async () => {
    const code = issueCode(authorize(client_id), 'user_1');
    await expect(exchange(code, { codeVerifier: 'wrong' })).rejects.toThrow(/PKCE/);
    await expect(exchange(code, { codeVerifier: null })).rejects.toThrow();
    await expect(exchange(code, { redirectUri: 'https://evil.com/cb' })).rejects.toThrow(
      /redirect_uri/,
    );
    const other = registerClient({ client_name: 'Other', redirect_uris: [REDIRECT] }).client_id;
    await expect(exchange(code, { clientId: other })).rejects.toThrow();
    await expect(exchange(`${code}x`)).rejects.toThrow();
    await expect(exchange(`${code}.ignored`)).rejects.toThrow();
    await expect(exchange(code, { redirectUri: null })).rejects.toThrow(/redirect_uri/);
  });

  it('rejects a token request for another resource', async () => {
    const code = issueCode(authorize(client_id), 'user_1');
    await expect(exchange(code, { resource: 'https://other.example/api' })).rejects.toThrow(
      /resource/,
    );
  });

  it('expires codes after two minutes', async () => {
    vi.useFakeTimers();
    const code = issueCode(authorize(client_id), 'user_1');
    vi.advanceTimersByTime(120_000);
    await expect(exchange(code)).rejects.toThrow(/expired/);
  });
});
