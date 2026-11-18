import { randomUUID } from 'node:crypto';
import { db, type Prisma } from '@easyrender/db';
import { Webhook } from 'svix';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleServiceEmailWebhook,
  queueRenderServiceEmail,
  queueServiceEmail,
  runServiceEmails,
  type ServiceEmailTexts,
  serviceEmailAvailable,
} from './service-email';

const provider = vi.hoisted(() => ({ get: vi.fn(), hasQueueFailure: false }));
vi.mock('./service-email', async (original) => {
  const real = await original<typeof import('./service-email')>();
  return {
    ...real,
    queueRenderServiceEmail: async (...args: Parameters<typeof real.queueRenderServiceEmail>) => {
      if (provider.hasQueueFailure) throw new Error('Storage unavailable');
      return real.queueRenderServiceEmail(...args);
    },
  };
});
vi.mock('@easyrender/harness', async (original) => ({
  ...(await original<typeof import('@easyrender/harness')>()),
  checkGlb: () => ({ ok: true, warnings: [], measures: { bytes: 50000 } }),
  download: async () => new Uint8Array([1, 2, 3]),
  createReplicate: () => ({ get: provider.get }),
}));
vi.mock('./storage', () => ({
  putFile: async () => 'private/model.glb',
  getFile: async () => new Uint8Array([1]),
}));
vi.mock('./analytics', () => ({ captureRender: vi.fn() }));
vi.mock('./report', () => ({ reportError: vi.fn() }));

import { advance } from './renders';

const url = process.env.TEST_DATABASE_URL;
if (url) {
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
    throw new Error('A local scratch database is required');
  process.env.DATABASE_URL = url;
}
const now = new Date('2026-11-16T02:00:00Z');
const secret = 'test-service-encryption-secret-not-production-12345';
const wh = `whsec_${Buffer.from('test-service-webhook-secret').toString('base64')}`;
const copy = {
  subject: 'Your requested action',
  body: 'You requested this account action.',
  action: 'Continue',
};
const texts: ServiceEmailTexts = {
  en: { render_ready: copy, render_failed: copy },
  es: { render_ready: copy, render_failed: copy },
};
const ids: string[] = [];
const receipts: string[] = [];
const users = async (verified = true) => {
  const id = `svc_${randomUUID()}`;
  ids.push(id);
  return db().user.create({
    data: { id, email: `${id}@example.com`, name: 'Test', emailVerified: verified },
  });
};
const queue = async (
  u: { id: string; email: string },
  purpose: 'verify_email' | 'reset_password' = 'reset_password',
  token: string = randomUUID(),
) => {
  await queueServiceEmail({
    purpose,
    userId: u.id,
    email: u.email,
    url: `https://example.com/${purpose === 'verify_email' ? 'verify-email' : 'reset-password'}?token=${token}`,
    locale: 'es',
    expiresAt: new Date(+now + 3600000),
    copy,
  });
};
const fake = vi.fn(async () =>
  Response.json({ id: `provider-${randomUUID()}` }),
) as unknown as typeof fetch;
const webhook = (type: string, providerId: string, email: string) => {
  const id = `evt_${randomUUID()}`;
  receipts.push(id);
  const raw = JSON.stringify({
    type,
    created_at: new Date().toISOString(),
    data: { email_id: providerId, to: [email] },
  });
  return {
    raw,
    headers: new Headers({
      'svix-id': id,
      'svix-timestamp': `${Math.floor(Date.now() / 1000)}`,
      'svix-signature': new Webhook(wh).sign(id, new Date(), raw),
    }),
  };
};
describe.skipIf(!url)('service email outbox: scratch DB and fake transport only', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    vi.mocked(fake)
      .mockReset()
      .mockImplementation(async () => Response.json({ id: `provider-${randomUUID()}` }));
    for (const [k, v] of Object.entries({
      VERCEL_ENV: 'production',
      SERVICE_EMAIL_ENABLED: 'true',
      SERVICE_EMAIL_ENCRYPTION_SECRET: secret,
      EMAIL_ONBOARDING_ENABLED: 'false',
      EMAIL_TOKEN_SECRET: '',
      RESEND_API_KEY: 'test-api-key',
      RESEND_WEBHOOK_SECRET: wh,
      EMAIL_FROM: 'Team <hello@example.com>',
      EMAIL_REPLY_TO: 'help@example.com',
      EMAIL_LEGAL_IDENTITY: 'Example address',
      EMAIL_ALLOWED_RECIPIENTS: '',
      APP_URL: 'https://example.com',
    }))
      vi.stubEnv(k, v);
  });
  afterEach(async () => {
    provider.hasQueueFailure = false;
    vi.restoreAllMocks();
    await db().emailProviderEvent.deleteMany({ where: { id: { in: receipts.splice(0) } } });
    await db().serviceEmailSuppression.deleteMany({
      where: { email: { in: ids.map((id) => `${id}@example.com`) } },
    });
    await db().render.deleteMany({ where: { userId: { in: ids } } });
    await db().user.deleteMany({ where: { id: { in: ids.splice(0) } } });
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });
  it('queues encrypted deduplicated auth mail and sends without marketing or quiet-hour consent', async () => {
    const u = await users(false);
    expect(serviceEmailAvailable()).toBe(true);
    await Promise.all([
      queue(u, 'verify_email', 'private-token'),
      queue(u, 'verify_email', 'private-token'),
    ]);
    const rows = await db().serviceEmailDelivery.findMany({ where: { userId: u.id } });
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain('private-token');
    expect(fake).not.toHaveBeenCalled();
    await runServiceEmails(texts, fake);
    expect(fake).toHaveBeenCalledTimes(1);
    const request = vi.mocked(fake).mock.calls[0][1];
    expect(request?.body).toContain('private-token');
    expect(request?.body).not.toContain('List-Unsubscribe');
    expect(
      (await db().serviceEmailDelivery.findUniqueOrThrow({ where: { id: rows[0].id } })).status,
    ).toBe('accepted');
  });
  it('fails closed when disabled, preview, address mismatched or external URL', async () => {
    const u = await users();
    vi.stubEnv('SERVICE_EMAIL_ENABLED', 'false');
    await expect(queue(u)).rejects.toThrow();
    vi.stubEnv('SERVICE_EMAIL_ENABLED', 'true');
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(serviceEmailAvailable()).toBe(false);
    vi.stubEnv('VERCEL_ENV', 'production');
    await expect(queue({ ...u, email: 'different@example.com' })).rejects.toThrow();
    await expect(
      queueServiceEmail({
        purpose: 'reset_password',
        userId: u.id,
        email: u.email,
        url: 'https://evil.example/reset',
        expiresAt: new Date(+now + 3600000),
        copy,
      }),
    ).rejects.toThrow();
    expect(await db().serviceEmailDelivery.count({ where: { userId: u.id } })).toBe(0);
  });
  it('cancels expired links, changed addresses and already verified verification requests', async () => {
    for (const mode of ['expired', 'changed', 'verified']) {
      const u = await users(false);
      await queue(u, 'verify_email');
      if (mode === 'expired') vi.setSystemTime(new Date(+now + 3600001));
      if (mode === 'changed')
        await db().user.update({ where: { id: u.id }, data: { email: `new-${u.email}` } });
      if (mode === 'verified')
        await db().user.update({ where: { id: u.id }, data: { emailVerified: true } });
      await runServiceEmails(texts, fake);
      expect(
        (await db().serviceEmailDelivery.findFirstOrThrow({ where: { userId: u.id } })).status,
      ).toBe('cancelled');
      vi.setSystemTime(now);
    }
    expect(fake).not.toHaveBeenCalled();
  });
  it('serializes concurrent workers and retries with the identical body and key', async () => {
    const u = await users();
    await queue(u);
    vi.mocked(fake).mockImplementation(async () => Response.json({}, { status: 503 }));
    await Promise.all([runServiceEmails(texts, fake), runServiceEmails(texts, fake)]);
    expect(fake).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date(+now + 600000));
    await runServiceEmails(texts, fake);
    expect(fake).toHaveBeenCalledTimes(2);
    const a = vi.mocked(fake).mock.calls[0][1],
      b = vi.mocked(fake).mock.calls[1][1];
    expect(a?.body).toBe(b?.body);
    expect(new Headers(a?.headers).get('Idempotency-Key')).toBe(
      new Headers(b?.headers).get('Idempotency-Key'),
    );
  });
  it('queues only new owned terminal renders with verified current email and uses private app links', async () => {
    const u = await users();
    const render = await db().render.create({
      data: {
        userId: u.id,
        status: 'ready',
        sourceKey: 'private/source',
        glbKey: 'private/model.glb',
        completedAt: now,
      },
    });
    await db().$transaction(async (tx) => {
      await queueRenderServiceEmail(render.id, tx);
      await queueRenderServiceEmail(render.id, tx);
    });
    await runServiceEmails(texts, fake);
    expect(fake).toHaveBeenCalledTimes(1);
    const body = String(vi.mocked(fake).mock.calls[0][1]?.body);
    expect(body).toContain(`next=${encodeURIComponent(`/r/${render.id}`)}`);
    expect(body).not.toContain('private/model');
    const unverified = await users(false);
    const other = await db().render.create({
      data: { userId: unverified.id, status: 'failed', sourceKey: 'x' },
    });
    await db().$transaction((tx) => queueRenderServiceEmail(other.id, tx));
    expect(await db().serviceEmailDelivery.count({ where: { userId: unverified.id } })).toBe(0);
  });
  it('retains signed early delivery receipts and rejects forged webhook', async () => {
    const u = await users();
    await queue(u);
    vi.mocked(fake).mockImplementation(async () => {
      const e = webhook('email.delivered', 'race', u.email);
      await handleServiceEmailWebhook(e.raw, e.headers);
      return Response.json({ id: 'race' });
    });
    await runServiceEmails(texts, fake);
    expect(
      (await db().serviceEmailDelivery.findFirstOrThrow({ where: { userId: u.id } })).status,
    ).toBe('delivered');
    await expect(handleServiceEmailWebhook('{}', new Headers())).rejects.toThrow();
  });
  it('holds provider-suppressed addresses even for future explicit requests, without consent coupling', async () => {
    const u = await users();
    await queue(u);
    vi.mocked(fake).mockImplementation(async () => {
      const e = webhook('email.bounced', 'bounce', u.email);
      await handleServiceEmailWebhook(e.raw, e.headers);
      return Response.json({ id: 'bounce' });
    });
    await runServiceEmails(texts, fake);
    expect(
      (await db().serviceEmailDelivery.findFirstOrThrow({ where: { userId: u.id } })).status,
    ).toBe('bounced');
    await expect(queue(u)).rejects.toThrow();
    expect(await db().emailSubscription.count({ where: { userId: u.id } })).toBe(0);
  });
  it('atomically queues a single service notification with ready or failed render completion', async () => {
    vi.stubEnv('REPLICATE_API_TOKEN', 'test');
    for (const status of ['succeeded', 'failed']) {
      const u = await users();
      const render = await db().render.create({
        data: {
          userId: u.id,
          sourceKey: 'x',
          status: 'rendering',
          buildPredictionId: randomUUID(),
          updatedAt: now,
        },
      });
      provider.get.mockResolvedValue({
        status,
        output: 'https://provider.invalid/result.glb',
        error: status === 'failed' ? 'Provider failed' : undefined,
      });
      await Promise.all([advance(render.id), advance(render.id)]);
      const rows = await db().serviceEmailDelivery.findMany({ where: { renderId: render.id } });
      expect(rows).toHaveLength(1);
      expect(rows[0].purpose).toBe(status === 'succeeded' ? 'render_ready' : 'render_failed');
      await advance(render.id);
      expect(await db().serviceEmailDelivery.count({ where: { renderId: render.id } })).toBe(1);
    }
  });
  it('rolls back completion when its notification intent cannot commit, then recovers', async () => {
    vi.stubEnv('REPLICATE_API_TOKEN', 'test');
    const u = await users();
    const render = await db().render.create({
      data: {
        userId: u.id,
        sourceKey: 'x',
        status: 'rendering',
        buildPredictionId: randomUUID(),
        updatedAt: now,
      },
    });
    provider.get.mockResolvedValue({
      status: 'succeeded',
      output: 'https://provider.invalid/result.glb',
    });
    provider.hasQueueFailure = true;
    await advance(render.id);
    expect((await db().render.findUniqueOrThrow({ where: { id: render.id } })).status).toBe(
      'rendering',
    );
    provider.hasQueueFailure = false;
    await advance(render.id);
    expect((await db().render.findUniqueOrThrow({ where: { id: render.id } })).status).toBe(
      'ready',
    );
    expect(await db().serviceEmailDelivery.count({ where: { renderId: render.id } })).toBe(1);
  });
  it('holds ambiguous attempts beyond 23 hours or six tries instead of issuing a new send', async () => {
    for (const exhausted of ['age', 'attempts']) {
      const u = await users();
      await queue(u);
      const row = await db().serviceEmailDelivery.findFirstOrThrow({ where: { userId: u.id } });
      await db().serviceEmailDelivery.update({
        where: { id: row.id },
        data: {
          status: 'retry',
          firstAttemptAt: new Date(+now - (exhausted === 'age' ? 23 : 1) * 3600000),
          attempts: exhausted === 'attempts' ? 6 : 1,
        },
      });
      await runServiceEmails(texts, fake);
      expect(
        (await db().serviceEmailDelivery.findUniqueOrThrow({ where: { id: row.id } })).status,
      ).toBe('held');
    }
    expect(fake).not.toHaveBeenCalled();
  });
  it('recovers an abandoned lease and ignores the stale worker response with the same provider key', async () => {
    const u = await users();
    await queue(u);
    let release: (value: Response) => void = () => {};
    let started: () => void = () => {};
    const began = new Promise<void>((resolve) => {
      started = resolve;
    });
    vi.mocked(fake)
      .mockImplementationOnce(async () => {
        started();
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      })
      .mockImplementation(async () => Response.json({ id: 'takeover' }));
    const first = runServiceEmails(texts, fake);
    await began;
    vi.setSystemTime(new Date(+now + 91000));
    await runServiceEmails(texts, fake);
    release(Response.json({ id: 'stale-response' }));
    await first;
    const row = await db().serviceEmailDelivery.findFirstOrThrow({ where: { userId: u.id } });
    expect(row.providerId).toBe('takeover');
    expect(row.attempts).toBe(2);
    const calls = vi.mocked(fake).mock.calls;
    expect(new Headers(calls[0][1]?.headers).get('Idempotency-Key')).toBe(
      new Headers(calls[1][1]?.headers).get('Idempotency-Key'),
    );
    expect(calls[0][1]?.body).toBe(calls[1][1]?.body);
  });
  it('holds encrypted payloads after an incompatible secret change without exposing the token', async () => {
    const u = await users();
    await queue(u, 'reset_password', 'private-recovery-token');
    vi.stubEnv('SERVICE_EMAIL_ENCRYPTION_SECRET', 'different-stable-secret-12345678901234567890');
    await runServiceEmails(texts, fake);
    const row = await db().serviceEmailDelivery.findFirstOrThrow({ where: { userId: u.id } });
    expect(row.status).toBe('held');
    expect(JSON.stringify(row)).not.toContain('private-recovery-token');
    expect(fake).not.toHaveBeenCalled();
  });
  it('supersedes pending auth links while preserving explicit duplicate request idempotency', async () => {
    const u = await users(false);
    await queue(u, 'verify_email', 'old');
    await queue(u, 'verify_email', 'new');
    await queue(u, 'verify_email', 'new');
    expect(await db().serviceEmailDelivery.count({ where: { userId: u.id } })).toBe(2);
    await runServiceEmails(texts, fake);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fake).mock.calls[0][1]?.body)).toContain('token=new');
    expect(
      await db().serviceEmailDelivery.count({
        where: { userId: u.id, status: 'cancelled', payloadEncrypted: null },
      }),
    ).toBe(1);
  });
  it('uses the model’s recorded interface language for a transactional email and its return', async () => {
    const u = await users();
    const render = await db().render.create({
      data: {
        userId: u.id,
        status: 'ready',
        glbKey: 'fixture.glb',
        sourceKey: 'fixture.jpg',
        landing_path: '/es',
        notificationLocale: 'fr',
      },
    });
    await db().$transaction((tx) => queueRenderServiceEmail(render.id, tx));
    const delivery = await db().serviceEmailDelivery.findFirstOrThrow({
      where: { renderId: render.id },
    });
    expect(delivery.locale).toBe('fr');
    await runServiceEmails(
      {
        ...texts,
        fr: {
          render_ready: { ...copy, lang: 'fr', subject: 'Votre modèle est prêt' },
          render_failed: copy,
        },
      },
      fake,
      { userId: u.id },
    );
    const payload = JSON.parse(String(vi.mocked(fake).mock.calls[0][1]?.body));
    expect(payload.subject).toBe('Votre modèle est prêt');
    expect(payload.html).toContain('lang="fr"');
    const url = new URL(String(payload.text).match(/https?:\/\/[^\s]+/)?.[0] ?? '');
    expect(url.pathname).toBe('/account');
    expect(url.searchParams.get('next')).toBe(`/r/${render.id}`);
    expect(url.searchParams.get('locale')).toBe('fr');
    await db().render.delete({ where: { id: render.id } });
  });
  it('does not backfill past renders, anonymous work or events that occurred while disabled', async () => {
    const u = await users();
    const render = await db().render.create({
      data: { userId: u.id, status: 'ready', sourceKey: 'x', glbKey: 'y' },
    });
    vi.stubEnv('SERVICE_EMAIL_ENABLED', 'false');
    await db().$transaction((tx) => queueRenderServiceEmail(render.id, tx));
    vi.stubEnv('SERVICE_EMAIL_ENABLED', 'true');
    await runServiceEmails(texts, fake);
    expect(fake).not.toHaveBeenCalled();
    expect(await db().serviceEmailDelivery.count({ where: { userId: u.id } })).toBe(0);
    await db().render.update({ where: { id: render.id }, data: { userId: null } });
    await db().$transaction((tx) => queueRenderServiceEmail(render.id, tx));
    expect(await db().serviceEmailDelivery.count({ where: { renderId: render.id } })).toBe(0);
    await db().render.delete({ where: { id: render.id } });
  });
  it('keeps old-address suppression isolated and delivered status monotonic against failure', async () => {
    const u = await users();
    await queue(u);
    vi.mocked(fake).mockResolvedValueOnce(Response.json({ id: 'old-address' }));
    await runServiceEmails(texts, fake);
    const delivered = webhook('email.delivered', 'old-address', u.email);
    await handleServiceEmailWebhook(delivered.raw, delivered.headers);
    const failed = webhook('email.failed', 'old-address', u.email);
    await handleServiceEmailWebhook(failed.raw, failed.headers);
    expect(
      (await db().serviceEmailDelivery.findFirstOrThrow({ where: { userId: u.id } })).status,
    ).toBe('delivered');
    const changed = { ...u, email: `new-${u.email}` };
    await db().user.update({ where: { id: u.id }, data: { email: changed.email } });
    const suppressed = webhook('email.suppressed', 'old-address', u.email);
    await handleServiceEmailWebhook(suppressed.raw, suppressed.headers);
    await handleServiceEmailWebhook(suppressed.raw, suppressed.headers);
    await queue(changed);
    await runServiceEmails(texts, fake);
    expect(fake).toHaveBeenCalledTimes(2);
    expect(
      await db().emailProviderEvent.count({
        where: { id: suppressed.headers.get('svix-id') ?? '' },
      }),
    ).toBe(1);
    expect(
      (
        await db().serviceEmailDelivery.findFirstOrThrow({
          where: { userId: u.id, providerId: 'old-address' },
        })
      ).status,
    ).toBe('suppressed');
  });
  it('cancels render messages if ownership, status or verification changes before delivery', async () => {
    for (const mode of ['ownership', 'status', 'verification']) {
      const u = await users();
      const r = await db().render.create({
        data: { userId: u.id, status: 'ready', sourceKey: 'x', glbKey: 'y' },
      });
      await db().$transaction((tx) => queueRenderServiceEmail(r.id, tx));
      if (mode === 'ownership')
        await db().render.update({ where: { id: r.id }, data: { userId: null } });
      if (mode === 'status')
        await db().render.update({ where: { id: r.id }, data: { status: 'failed' } });
      if (mode === 'verification')
        await db().user.update({ where: { id: u.id }, data: { emailVerified: false } });
      await runServiceEmails(texts, fake);
      expect(
        (await db().serviceEmailDelivery.findFirstOrThrow({ where: { userId: u.id } })).status,
      ).toBe('cancelled');
      await db().render.delete({ where: { id: r.id } });
    }
    expect(fake).not.toHaveBeenCalled();
  });
  it('sends requested service mail despite educational unsubscribe, age and sequence caps', async () => {
    const u = await users();
    await db().user.update({
      where: { id: u.id },
      data: { createdAt: new Date(+now - 90 * 86400000) },
    });
    await db().emailSubscription.create({
      data: {
        userId: u.id,
        email: u.email,
        locale: 'es',
        timezone: 'Europe/Madrid',
        route: 'general',
        consentVersion: 'test',
        requestedAt: now,
        confirmExpiresAt: now,
        status: 'unsubscribed',
        consentNonce: randomUUID(),
        unsubscribeNonce: randomUUID(),
        expiresAt: new Date(+now - 86400000),
      },
    });
    await queue(u);
    await runServiceEmails(texts, fake);
    expect(fake).toHaveBeenCalledTimes(1);
  });
  it('rechecks the current address after claiming and before calling the provider', async () => {
    const u = await users();
    await queue(u);
    const original = db().$transaction.bind(db());
    type Transaction = (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => Promise<unknown>;
    let hasChanged = false;
    const intercept: Transaction = async (fn) => {
      const result = await (original as unknown as Transaction)(fn);
      if (
        !hasChanged &&
        result &&
        typeof result === 'object' &&
        'status' in result &&
        result.status === 'sending'
      ) {
        hasChanged = true;
        await db().user.update({ where: { id: u.id }, data: { email: `new-${u.email}` } });
      }
      return result;
    };
    vi.spyOn(db(), '$transaction').mockImplementation(intercept as typeof original);
    await runServiceEmails(texts, fake);
    expect(hasChanged).toBe(true);
    expect(fake).not.toHaveBeenCalled();
    expect(
      (await db().serviceEmailDelivery.findFirstOrThrow({ where: { userId: u.id } })).status,
    ).toBe('cancelled');
  });
  it('records early provider failures without suppressing the address or sending again', async () => {
    const u = await users();
    await queue(u);
    vi.mocked(fake).mockImplementationOnce(async () => {
      const e = webhook('email.failed', 'early-failure', u.email);
      await handleServiceEmailWebhook(e.raw, e.headers);
      return Response.json({ id: 'early-failure' });
    });
    await runServiceEmails(texts, fake);
    expect(
      (await db().serviceEmailDelivery.findFirstOrThrow({ where: { userId: u.id } })).status,
    ).toBe('failed');
    expect(await db().serviceEmailSuppression.findUnique({ where: { email: u.email } })).toBeNull();
    await runServiceEmails(texts, fake);
    expect(fake).toHaveBeenCalledTimes(1);
  });
  it('limits new auth messages to three per recipient and purpose per hour without destroying the last valid payload', async () => {
    const u = await users(false);
    await queue(u, 'verify_email', 'first');
    await queue(u, 'verify_email', 'second');
    await queue(u, 'verify_email', 'third');
    const latest = await db().serviceEmailDelivery.findFirstOrThrow({
      where: { userId: u.id, status: 'queued' },
    });
    await expect(queue(u, 'verify_email', 'fourth')).rejects.toMatchObject({
      status: 429,
      code: 'service_email_rate_limited',
    });
    expect(await db().serviceEmailDelivery.count({ where: { userId: u.id } })).toBe(3);
    expect(
      (await db().serviceEmailDelivery.findUniqueOrThrow({ where: { id: latest.id } }))
        .payloadEncrypted,
    ).toBe(latest.payloadEncrypted);
    await expect(queue(u, 'verify_email', 'third')).resolves.toBeUndefined();
    await queue(u, 'reset_password', 'independent-purpose');
    expect(await db().serviceEmailDelivery.count({ where: { userId: u.id } })).toBe(4);
    expect(fake).not.toHaveBeenCalled();
  });
  it('enforces the durable hourly cap across concurrent explicit requests and opens only after the window', async () => {
    const u = await users();
    const requests = await Promise.allSettled(
      Array.from({ length: 5 }, (_, index) => queue(u, 'reset_password', `request-${index}`)),
    );
    expect(requests.filter((result) => result.status === 'fulfilled')).toHaveLength(3);
    expect(requests.filter((result) => result.status === 'rejected')).toHaveLength(2);
    expect(await db().serviceEmailDelivery.count({ where: { userId: u.id } })).toBe(3);
    vi.setSystemTime(new Date(+now + 3600001));
    await queueServiceEmail({
      purpose: 'reset_password',
      userId: u.id,
      email: u.email,
      url: 'https://example.com/reset-password?token=after-window',
      expiresAt: new Date(Date.now() + 3600000),
      copy,
    });
    expect(await db().serviceEmailDelivery.count({ where: { userId: u.id } })).toBe(4);
    expect(fake).not.toHaveBeenCalled();
  });
  it('shares the recipient cap across accounts with email casing differences', async () => {
    const u = await users();
    const id = `svc_${randomUUID()}`;
    ids.push(id);
    const alternate = await db().user.create({
      data: { id, email: u.email.toUpperCase(), name: 'Test', emailVerified: true },
    });
    const results = await Promise.allSettled([
      queue(u, 'reset_password', 'a'),
      queue(alternate, 'reset_password', 'b'),
      queue(u, 'reset_password', 'c'),
      queue(alternate, 'reset_password', 'd'),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(3);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(
      await db().serviceEmailDelivery.count({
        where: { email: { equals: u.email, mode: 'insensitive' } },
      }),
    ).toBe(3);
    expect(fake).not.toHaveBeenCalled();
  });
});
