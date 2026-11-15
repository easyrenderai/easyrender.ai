import { generateKeyPairSync, sign } from 'node:crypto';
import { db } from '@easyrender/db';
import { afterAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const url = process.env.TEST_DATABASE_URL;
if (url) {
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
    throw new Error('Local test database only');
  process.env.DATABASE_URL = url;
}
describe.skipIf(!url)('Google attribution through real Better Auth state and callback', () => {
  afterAll(async () => {
    vi.unstubAllGlobals();
    await db().$disconnect();
  });
  it('keeps normalized first touch in server state and creates the user on a signed mocked Google callback', async () => {
    process.env.BETTER_AUTH_URL = 'http://localhost:3100';
    process.env.BETTER_AUTH_SECRET = 'local-only-auth-integration-secret-123456789';
    process.env.GOOGLE_CLIENT_ID = 'local-google-client';
    process.env.GOOGLE_CLIENT_SECRET = 'local-google-secret';
    delete process.env.BETTER_AUTH_API_KEY;
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const { auth } = await import('../auth');
    const response = await auth().handler(
      new Request('http://localhost:3100/api/auth/sign-in/social', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost:3100',
          'x-vercel-ip-country': 'GB',
        },
        body: JSON.stringify({
          provider: 'google',
          callbackURL: 'http://localhost:3100/dashboard',
          additionalData: {
            attribution: {
              utm_campaign: 'GOOGLE-FIRST',
              utm_source: 'TEST',
              landing_path: '/fr?gclid=abc',
              referrer: 'https://referrer.test/path?private=1',
            },
          },
        }),
      }),
    );
    expect(response.status).toBe(200);
    const authorization = new URL((await response.json()).url);
    const state = authorization.searchParams.get('state');
    const stored = await db().verification.findFirstOrThrow({
      where: { identifier: `auth-state:${state}` },
    });
    const storedValue = JSON.parse(stored.value);
    expect(storedValue.serverContext.attribution).toMatchObject({
      utm_campaign: 'google-first',
      geo_country: 'GB',
      landing_path: '/fr',
      referrer: 'https://referrer.test/path',
    });
    const cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');
    expect(cookie).not.toContain('er_consent');
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const now = Math.floor(Date.now() / 1000);
    const subject = crypto.randomUUID();
    const email = `google-${subject}@example.invalid`;
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'RS256', kid: 'local-qa' })}.${encode({ iss: 'https://accounts.google.com', aud: 'local-google-client', sub: subject, iat: now, exp: now + 300, nonce: authorization.searchParams.get('nonce'), email, name: 'Local QA', email_verified: true })}`;
    const token = `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`;
    vi.stubGlobal('fetch', async (input: string | URL | Request) => {
      const target = input instanceof Request ? input.url : String(input);
      if (target === 'https://oauth2.googleapis.com/token')
        return Response.json({
          access_token: 'local-only-access',
          token_type: 'Bearer',
          expires_in: 300,
          id_token: token,
        });
      if (target === 'https://www.googleapis.com/oauth2/v3/certs')
        return Response.json({
          keys: [
            { ...publicKey.export({ format: 'jwk' }), kid: 'local-qa', alg: 'RS256', use: 'sig' },
          ],
        });
      throw new Error('Unexpected outbound request in mocked OAuth flow');
    });
    const callback = await auth().handler(
      new Request(`http://localhost:3100/api/auth/callback/google?state=${state}&code=local-code`, {
        headers: { cookie, 'x-vercel-ip-country': 'US' },
      }),
    );
    expect(callback.status).toBe(302);
    expect(callback.headers.get('location')).toBe('http://localhost:3100/dashboard');
    const user = await db().user.findUniqueOrThrow({ where: { email } });
    expect(user).toMatchObject({
      utm_campaign: 'google-first',
      geo_country: 'GB',
      consent_region_at_create: 'strict',
      landing_path: '/fr',
    });
    expect(
      await db().verification.findFirst({ where: { identifier: `auth-state:${state}` } }),
    ).toBeNull();
  }, 15_000);
});
