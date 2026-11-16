import { randomUUID } from 'node:crypto';
import { runServiceEmails } from '@easyrender/core';
import { db } from '@easyrender/db';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@better-auth/infra', () => ({ dash: () => ({ id: 'test-no-dashboard' }) }));
vi.mock('next/server', async (original) => ({
  ...(await original<typeof import('next/server')>()),
  after: () => {},
}));
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl) {
  const parsed = new URL(databaseUrl);
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname))
    throw new Error('Use a local scratch database');
  process.env.DATABASE_URL = databaseUrl;
}
const email = `auth-${randomUUID()}@example.invalid`;
const payloads: Array<{ html: string; text: string; subject: string }> = [];
const fakeTransport: typeof fetch = async (_input, init) => {
  payloads.push(JSON.parse(String(init?.body)));
  return Response.json({ id: randomUUID() });
};
describe.skipIf(!databaseUrl)('real Better Auth to encrypted service outbox', () => {
  beforeAll(() => {
    for (const [key, value] of Object.entries({
      BETTER_AUTH_URL: 'https://example.test',
      APP_URL: 'https://example.test',
      BETTER_AUTH_SECRET: 'local-test-auth-secret-never-production-123456789',
      VERCEL_ENV: 'production',
      SERVICE_EMAIL_ENABLED: 'true',
      SERVICE_EMAIL_ENCRYPTION_SECRET: 'local-test-encryption-secret-never-production-123456789',
      RESEND_API_KEY: 'unit-test-key',
      RESEND_WEBHOOK_SECRET: 'unit-test-webhook-secret',
      EMAIL_FROM: 'Example <hello@example.test>',
      EMAIL_REPLY_TO: 'help@example.test',
      EMAIL_LEGAL_IDENTITY: 'Example company, test address',
      NEXT_PUBLIC_POSTHOG_KEY: '',
      NEXT_PUBLIC_SENTRY_DSN: '',
      BETTER_AUTH_API_KEY: '',
    }))
      vi.stubEnv(key, value);
    vi.stubGlobal('fetch', () => {
      throw new Error('No real network allowed');
    });
  });
  afterAll(async () => {
    await db().user.deleteMany({ where: { email } });
    await db().$disconnect();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it('persists real hooks, dispatches only through fake transport, verifies and resets with emitted tokens', async () => {
    const { auth } = await import('@/lib/auth');
    const { serviceEmailTexts } = await import('@/lib/service-email');
    const post = (path: string, body: object) =>
      auth().handler(
        new Request(`https://example.test/api/auth/${path}`, {
          method: 'POST',
          headers: {
            origin: 'https://example.test',
            'content-type': 'application/json',
            'x-easyrender-email-locale': 'es',
          },
          body: JSON.stringify(body),
        }),
      );
    const signup = await post('sign-up/email', {
      name: 'Local QA',
      email,
      password: 'test-password-123',
    });
    expect(signup.status).toBe(200);
    const user = await db().user.findUniqueOrThrow({ where: { email } });
    let rows = await db().serviceEmailDelivery.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ purpose: 'verify_email', locale: 'es', status: 'queued' });
    expect(rows[0].payloadEncrypted).toMatch(/^v1\./);
    expect(rows[0].payloadEncrypted).not.toContain('token=');
    expect(payloads).toHaveLength(0);
    await runServiceEmails(serviceEmailTexts, fakeTransport, { userId: user.id, limit: 1 });
    expect(payloads).toHaveLength(1);
    const verification = payloads[0].text.match(
      /https:\/\/example\.test\/verify-email\?[^\s]+/,
    )?.[0];
    expect(verification).toBeDefined();
    const { POST } = await import('@/app/api/email/verify-account/route');
    const verified = await POST(
      new Request('https://example.test/api/email/verify-account', {
        method: 'POST',
        headers: { origin: 'https://example.test', 'content-type': 'application/json' },
        body: JSON.stringify({ token: new URL(verification ?? '').searchParams.get('token') }),
      }),
    );
    expect(verified.status).toBe(200);
    expect((await db().user.findUniqueOrThrow({ where: { email } })).emailVerified).toBe(true);
    const crossOrigin = await POST(
      new Request('https://example.test/api/email/verify-account', {
        method: 'POST',
        headers: { origin: 'https://evil.invalid', 'content-type': 'application/json' },
        body: JSON.stringify({ token: 'invalid' }),
      }),
    );
    expect(crossOrigin.status).toBe(403);
    const recovery = await post('request-password-reset', { email });
    expect(recovery.status).toBe(200);
    rows = await db().serviceEmailDelivery.findMany({
      where: { userId: user.id, purpose: 'reset_password' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('queued');
    await runServiceEmails(serviceEmailTexts, fakeTransport, { userId: user.id, limit: 1 });
    const reset = payloads
      .at(-1)
      ?.text.match(/https:\/\/example\.test\/reset-password\?[^\s]+/)?.[0];
    expect(reset).toBeDefined();
    const resetToken = new URL(reset ?? '').searchParams.get('token');
    expect(JSON.stringify(await db().verification.findMany())).not.toContain(resetToken);
    expect(
      (
        await post('reset-password', {
          token: new URL(reset ?? '').searchParams.get('token'),
          newPassword: 'changed-password-456',
        })
      ).status,
    ).toBe(200);
    expect(await db().session.count({ where: { userId: user.id } })).toBe(0);
  }, 15000);
});
