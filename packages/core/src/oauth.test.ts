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

const {
  exchangeCode,
  issueCode,
  parseAuthorizeRequest,
  readClient,
  redirectTrust,
  registerClient,
} = await import('./oauth');

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

  it('rejects wildcard, credentialed and oversized redirect URIs', () => {
    for (const uri of [
      'https://*.example.com/cb',
      'https://example.com/*',
      'https://claude.ai@evil.example.com/cb',
      'https://user:pass@example.com/cb',
      `https://example.com/${'a'.repeat(2100)}`,
    ]) {
      expect(() => registerClient({ redirect_uris: [uri] })).toThrow(/redirect_uris/);
    }
  });

  it('cleans the client name before it reaches the consent screen', () => {
    const { client_name } = registerClient({
      client_name: '  Claude\n\u202Ereal\u0000  app  '.padEnd(200, 'x'),
      redirect_uris: [REDIRECT],
    });
    expect(client_name).not.toMatch(/[\p{Cc}\p{Cf}]/u);
    expect(client_name.length).toBeLessThanOrEqual(60);
    expect(registerClient({ client_name: '\n\u202E', redirect_uris: [REDIRECT] }).client_name).toBe(
      'MCP client',
    );
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

describe('client trust shown on the consent screen', () => {
  const trustOf = (redirect: string, name = 'Claude') =>
    parseAuthorizeRequest(
      new URLSearchParams({
        client_id: registerClient({ client_name: name, redirect_uris: [redirect] }).client_id,
        redirect_uri: redirect,
        response_type: 'code',
        code_challenge: challenge,
        code_challenge_method: 'S256',
      }),
    ).trust;

  it('verifies known client hosts and loopback apps, and nothing else', () => {
    expect(trustOf('https://claude.ai/api/mcp/auth_callback')).toBe('verified');
    expect(trustOf('https://chatgpt.com/connector_platform_oauth_redirect')).toBe('verified');
    expect(trustOf('http://localhost:6274/oauth/callback')).toBe('local');
    expect(trustOf('http://127.0.0.1:33418/callback')).toBe('local');
    expect(trustOf('https://attacker.example.com/cb')).toBe('unverified');
  });

  it('does not trust a name, a lookalike host or a subdomain of a known host', () => {
    expect(trustOf('https://attacker.example.com/cb', 'Claude')).toBe('unverified');
    expect(trustOf('https://claude.ai.evil.example.com/cb')).toBe('unverified');
    expect(trustOf('https://evil-claude.ai/cb')).toBe('unverified');
    expect(trustOf('https://sub.claude.ai/cb')).toBe('unverified');
    expect(redirectTrust('not a url')).toBe('unverified');
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
