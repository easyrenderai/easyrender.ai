import { createHash, randomUUID } from 'node:crypto';
import { db } from '@easyrender/db';
import { afterAll, describe, expect, it } from 'vitest';
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  verifyApiKey,
  verifyApiKeyPrincipal,
} from './api-keys';
import { exchangeCode, issueCode, parseAuthorizeRequest, registerClient } from './oauth';

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;
process.env.BETTER_AUTH_SECRET = 'oauth-integration-only-secret-not-production';
const users: string[] = [];
const redirect = 'https://client.example/callback';
const verifier = 'v'.repeat(64);
const challenge = createHash('sha256').update(verifier).digest('base64url');

function grant(userId: string) {
  const { client_id } = registerClient({
    client_name: 'Integration test',
    redirect_uris: [redirect],
  });
  const authorization = parseAuthorizeRequest(
    new URLSearchParams({
      client_id,
      redirect_uri: redirect,
      response_type: 'code',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }),
  );
  return {
    code: issueCode(authorization, userId),
    clientId: client_id,
    redirectUri: redirect,
    codeVerifier: verifier,
  };
}

async function user() {
  const id = `oauth_${randomUUID()}`;
  users.push(id);
  await db().user.create({ data: { id, name: 'OAuth test', email: `${id}@example.test` } });
  return id;
}

describe.skipIf(!url)('OAuth redemption and API keys (real database)', () => {
  afterAll(async () => {
    await db().user.deleteMany({ where: { id: { in: users } } });
    await db().$disconnect();
  });

  it('lets only one simultaneous exchange of a code create an API key', async () => {
    const id = await user();
    const input = grant(id);
    const outcomes = await Promise.allSettled(Array.from({ length: 8 }, () => exchangeCode(input)));
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(await listApiKeys(id)).toHaveLength(1);
  });

  it('does not resurrect a revoked key when its authorization code is replayed', async () => {
    const id = await user();
    const input = grant(id);
    const token = await exchangeCode(input);
    const [key] = await listApiKeys(id);
    if (!key) throw new Error('Token exchange did not create a key');
    await revokeApiKey(id, key.id);
    await expect(exchangeCode(input)).rejects.toMatchObject({ code: 'invalid_grant' });
    expect(await listApiKeys(id)).toHaveLength(0);
    expect(await verifyApiKey(token.access_token)).toBeNull();
  });

  it('does not consume a code on invalid PKCE', async () => {
    const input = grant(await user());
    await expect(exchangeCode({ ...input, codeVerifier: 'w'.repeat(64) })).rejects.toThrow(/PKCE/);
    expect((await exchangeCode(input)).access_token).toMatch(/^er_/);
  });

  it('rolls back code consumption if creating its key fails', async () => {
    const id = `oauth_${randomUUID()}`;
    users.push(id);
    const input = grant(id);
    await expect(exchangeCode(input)).rejects.toThrow();
    await db().user.create({ data: { id, name: 'OAuth test', email: `${id}@example.test` } });
    expect((await exchangeCode(input)).access_token).toMatch(/^er_/);
    await expect(exchangeCode(input)).rejects.toMatchObject({ code: 'invalid_grant' });
  });

  it('throttles usage timestamps without caching a revoked credential', async () => {
    const id = await user();
    const key = await createApiKey(id, 'Timestamp test');
    expect(await verifyApiKey(key.key)).toBe(id);
    const [first] = await listApiKeys(id);
    expect(first?.lastUsedAt).toBeInstanceOf(Date);
    expect(await verifyApiKey(key.key)).toBe(id);
    const [second] = await listApiKeys(id);
    expect(second?.lastUsedAt).toEqual(first?.lastUsedAt);
    await revokeApiKey(id, key.id);
    expect(await verifyApiKey(key.key)).toBeNull();
  });
  it('stores scoped limits and returns them without exposing a key hash', async () => {
    const id = await user();
    const expiresAt = new Date(Date.now() + 60_000);
    const key = await createApiKey(id, 'Read only', {
      scopes: ['read'],
      creditLimit: 0,
      expiresAt,
    });
    expect(await verifyApiKeyPrincipal(key.key)).toMatchObject({
      id: key.id,
      userId: id,
      scopes: ['read'],
      creditLimit: 0,
      spentCredits: 0,
      expiresAt,
    });
    const [listed] = await listApiKeys(id);
    expect(listed).toMatchObject({ scopes: ['read'], creditLimit: 0, spentCredits: 0, expiresAt });
    expect(listed).not.toHaveProperty('hash');
    expect(listed).not.toHaveProperty('key');
  });

  it('rejects expired keys on the next request without a cached grace period', async () => {
    const id = await user();
    const key = await createApiKey(id, 'Expiring', { expiresAt: new Date(Date.now() + 60_000) });
    expect(await verifyApiKey(key.key)).toBe(id);
    await db().apiKey.update({
      where: { id: key.id },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    expect(await verifyApiKey(key.key)).toBeNull();
  });

  it('preserves unlimited full-access manual keys unless restrictions are requested', async () => {
    const key = await createApiKey(await user(), 'Legacy behavior');
    expect(await verifyApiKeyPrincipal(key.key)).toMatchObject({
      scopes: ['read', 'write', 'spend', 'share'],
      creditLimit: null,
      spentCredits: 0,
      expiresAt: null,
    });
  });

  it('rejects invalid limits and expiration before creating a credential', async () => {
    const id = await user();
    for (const creditLimit of [-1, 1.5, Number.NaN, 2_147_483_648]) {
      await expect(createApiKey(id, 'Invalid', { creditLimit })).rejects.toMatchObject({
        code: 'bad_key_options',
      });
    }
    for (const expiresAt of [new Date(0), new Date(Number.NaN)]) {
      await expect(createApiKey(id, 'Invalid', { expiresAt })).rejects.toMatchObject({
        code: 'bad_key_options',
      });
    }
    await expect(createApiKey(id, 'Invalid', { scopes: [] })).rejects.toMatchObject({
      code: 'bad_key_options',
    });
    expect(await listApiKeys(id)).toHaveLength(0);
  });
});
