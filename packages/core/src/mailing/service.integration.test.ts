import { randomUUID } from 'node:crypto';
import { db, type Prisma } from '@easyrender/db';
import { Webhook } from 'svix';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAY, type MailingCatalog } from './policy';
import { makeMailToken } from './security';
import {
  confirmMailing,
  dispatchMailingConfirmation,
  handleMailingWebhook,
  mailingStatus,
  requestMailing,
  runMailing,
  stopMailing,
  unsubscribeMailing,
} from './service';

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;
const now = new Date('2026-11-16T11:00:00Z');
const secret = 'integration-test-secret-not-production-123456789';
const webhookSecret = `whsec_${Buffer.from('integration-test-webhook-not-production').toString('base64')}`;
const copy = {
  subject: 'A useful story',
  preheader: 'A useful lesson',
  body: 'An illustrative story.',
  action: 'Review one thing.',
};
const system = {
  confirmSubject: 'Confirm',
  confirmBody: 'You requested lessons',
  confirmAction: 'Confirm request',
  footerReason: 'Requested lessons',
  unsubscribeLabel: 'Stop lessons',
  preferencesLabel: 'Preferences',
};
const texts = { en: system, es: system };
const catalog: MailingCatalog = {
  es: { general_d00: copy, general_d02: copy, general_d05: copy },
  en: { general_d00: copy, general_d02: copy, general_d05: copy },
};
const ids: string[] = [];
const receiptIds: string[] = [];
const fakeFetch = vi.fn(
  async () => new Response(JSON.stringify({ id: `provider-${randomUUID()}` }), { status: 200 }),
) as unknown as typeof fetch;
const user = async (age = 0) => {
  const id = `mailtest_${randomUUID()}`;
  ids.push(id);
  await db().user.create({
    data: {
      id,
      email: `${id}@example.com`,
      name: 'Test',
      emailVerified: true,
      createdAt: new Date(+now - age * DAY),
    },
  });
  return id;
};
const subscribe = (id: string) =>
  requestMailing(id, { locale: 'es', timezone: 'Europe/Madrid' }, {}, texts);
const sub = (id: string) => db().emailSubscription.findUniqueOrThrow({ where: { userId: id } });
const token = async (id: string, purpose: 'confirm' | 'unsubscribe' = 'confirm') => {
  const s = await sub(id);
  return makeMailToken(
    s.id,
    purpose === 'confirm' ? s.consentNonce : s.unsubscribeNonce,
    purpose,
    secret,
  );
};
const activate = async (id: string) => {
  await subscribe(id);
  await confirmMailing(await token(id));
};
const webhook = (type: string, data: Record<string, unknown>) => {
  const raw = JSON.stringify({ type, created_at: new Date().toISOString(), data });
  const id = `evt_${randomUUID()}`;
  receiptIds.push(id);
  const at = new Date();
  return {
    raw,
    headers: {
      'svix-id': id,
      'svix-timestamp': `${Math.floor(+at / 1000)}`,
      'svix-signature': new Webhook(webhookSecret).sign(id, at, raw),
    },
  };
};

describe.skipIf(!url)('mailing outbox (real scratch database, fake delivery)', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    vi.mocked(fakeFetch)
      .mockReset()
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ id: `provider-${randomUUID()}` }), { status: 200 }),
      );
    for (const [k, v] of Object.entries({
      VERCEL_ENV: 'production',
      EMAIL_ONBOARDING_ENABLED: 'true',
      EMAIL_TOKEN_SECRET: secret,
      RESEND_API_KEY: 'unit-test-key',
      RESEND_WEBHOOK_SECRET: webhookSecret,
      EMAIL_FROM: 'Team <hello@example.com>',
      EMAIL_REPLY_TO: 'help@example.com',
      EMAIL_LEGAL_IDENTITY: 'Example company, postal address',
      APP_URL: 'https://example.com',
    }))
      vi.stubEnv(k, v);
    vi.stubEnv('EMAIL_ALLOWED_RECIPIENTS', '');
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await db().emailProviderEvent.deleteMany({ where: { id: { in: receiptIds.splice(0) } } });
    await db().render.deleteMany({ where: { userId: { in: ids } } });
    await db().user.deleteMany({ where: { id: { in: ids.splice(0) } } });
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });
  it('queues one confirmation for simultaneous explicit requests and never extends the registration deadline', async () => {
    const id = await user(2);
    const results = await Promise.allSettled([subscribe(id), subscribe(id)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const s = await sub(id);
    expect(s.status).toBe('pending');
    expect(s.expiresAt).toEqual(new Date(+now + 28 * DAY));
    expect(await db().emailDelivery.count({ where: { subscriptionId: s.id } })).toBe(1);
    expect(
      await db().emailConsentEvent.count({ where: { subscriptionId: s.id, event: 'requested' } }),
    ).toBe(1);
    expect(vi.mocked(fakeFetch)).not.toHaveBeenCalled();
  });
  it('requires a valid confirmation purpose and makes confirmation replay idempotent', async () => {
    const id = await user();
    await subscribe(id);
    expect(await confirmMailing(await token(id, 'unsubscribe'))).toBe(false);
    expect(await confirmMailing(await token(id))).toBe(true);
    expect(await confirmMailing(await token(id))).toBe(true);
    expect((await sub(id)).status).toBe('active');
    expect(
      await db().emailConsentEvent.count({
        where: { subscriptionId: (await sub(id)).id, event: 'confirmed' },
      }),
    ).toBe(1);
  });
  it('refuses a new registration sequence at day thirty', async () => {
    const id = await user(30);
    await expect(subscribe(id)).rejects.toMatchObject({ code: 'mailing_expired' });
    expect(await db().emailSubscription.count({ where: { userId: id } })).toBe(0);
  });
  it('throttles resends, rotates confirmation tokens only on a new explicit request and caps requests', async () => {
    const id = await user();
    await subscribe(id);
    const old = await token(id);
    await expect(subscribe(id)).rejects.toMatchObject({ code: 'mailing_rate_limited' });
    expect(await db().emailDelivery.count({ where: { subscriptionId: (await sub(id)).id } })).toBe(
      1,
    );
    vi.setSystemTime(+now + (2 * DAY) / 24);
    await subscribe(id);
    expect(await confirmMailing(old)).toBe(false);
    vi.setSystemTime(+now + (4 * DAY) / 24);
    await subscribe(id);
    vi.setSystemTime(+now + (6 * DAY) / 24);
    await expect(subscribe(id)).rejects.toMatchObject({ code: 'mailing_rate_limited' });
  });
  it('cancels pending mail on unsubscribe and preserves unsubscribe when old confirmation is replayed', async () => {
    const id = await user();
    await subscribe(id);
    const confirmation = await token(id);
    expect(await unsubscribeMailing(await token(id, 'unsubscribe'))).toBe(true);
    expect(await confirmMailing(confirmation)).toBe(false);
    expect((await sub(id)).status).toBe('unsubscribed');
    expect(
      await db().emailDelivery.count({
        where: { subscriptionId: (await sub(id)).id, status: 'cancelled' },
      }),
    ).toBe(1);
  });
  it('does not confirm an old address after the account email changes', async () => {
    const id = await user();
    await subscribe(id);
    await db().user.update({ where: { id }, data: { email: `changed-${id}@example.com` } });
    expect(await confirmMailing(await token(id))).toBe(false);
    expect((await mailingStatus(id)).status).toBe('held');
  });
  it('sends only one immutable onboarding message when workers run concurrently', async () => {
    const id = await user();
    await activate(id);
    await Promise.all([
      runMailing(catalog, texts, fakeFetch),
      runMailing(catalog, texts, fakeFetch),
    ]);
    expect(vi.mocked(fakeFetch)).toHaveBeenCalledTimes(1);
    const rows = await db().emailDelivery.findMany({
      where: { subscriptionId: (await sub(id)).id, kind: 'onboarding' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'accepted', attempts: 1, deliveredAt: null });
    expect(rows[0].firstAttemptAt).toEqual(now);
  });
  it('does not send onboarding without confirmed consent', async () => {
    const id = await user();
    await subscribe(id);
    await runMailing(catalog, texts, fakeFetch);
    expect(vi.mocked(fakeFetch)).toHaveBeenCalledTimes(1);
    expect(
      await db().emailDelivery.count({
        where: { subscriptionId: (await sub(id)).id, kind: 'onboarding' },
      }),
    ).toBe(0);
  });
  it('does not catch up a missed slot or reset thirty days on confirmation', async () => {
    const id = await user(1.2);
    await activate(id);
    await runMailing(catalog, texts, fakeFetch);
    expect(vi.mocked(fakeFetch)).not.toHaveBeenCalled();
    const late = await user(29.9);
    await subscribe(late);
    vi.setSystemTime(+now + 0.2 * DAY);
    expect(await confirmMailing(await token(late))).toBe(false);
  });
  it('holds queued mail when the current account email no longer matches', async () => {
    const id = await user();
    await activate(id);
    await db().user.update({ where: { id }, data: { email: `changed-${id}@example.com` } });
    await runMailing(catalog, texts, fakeFetch);
    expect(vi.mocked(fakeFetch)).not.toHaveBeenCalled();
    expect((await sub(id)).status).toBe('held');
  });
  it('respects pause, quiet hours and active rendering without consuming a slot', async () => {
    const id = await user();
    await activate(id);
    const s = await sub(id);
    await db().emailSubscription.update({ where: { id: s.id }, data: { isPaused: true } });
    await runMailing(catalog, texts, fakeFetch);
    expect(vi.mocked(fakeFetch)).not.toHaveBeenCalled();
    await db().emailSubscription.update({
      where: { id: s.id },
      data: { isPaused: false, timezone: 'Pacific/Honolulu', nextCheckAt: now },
    });
    await runMailing(catalog, texts, fakeFetch);
    expect(vi.mocked(fakeFetch)).not.toHaveBeenCalled();
    await db().emailSubscription.update({
      where: { id: s.id },
      data: { timezone: 'Europe/Madrid', nextCheckAt: now },
    });
    await db().render.create({ data: { userId: id, sourceKey: 'test', status: 'rendering' } });
    await runMailing(catalog, texts, fakeFetch);
    expect(vi.mocked(fakeFetch)).not.toHaveBeenCalled();
    expect(
      await db().emailDelivery.count({ where: { subscriptionId: s.id, kind: 'onboarding' } }),
    ).toBe(0);
  });
  it('counts an ambiguous first attempt against frequency pressure and retries the identical payload', async () => {
    const id = await user();
    await activate(id);
    vi.mocked(fakeFetch).mockResolvedValueOnce(new Response('', { status: 503 }));
    await runMailing(catalog, texts, fakeFetch);
    const entry = await db().emailDelivery.findFirstOrThrow({
      where: { subscriptionId: (await sub(id)).id, kind: 'onboarding' },
    });
    expect(entry.status).toBe('retry');
    const original = entry.payload;
    vi.setSystemTime(+now + 10 * 60 * 1000);
    const changed = {
      ...catalog,
      es: { ...catalog.es, general_d00: { ...copy, body: 'Changed after initial attempt' } },
    };
    await runMailing(changed, texts, fakeFetch);
    const sent = await db().emailDelivery.findUniqueOrThrow({ where: { id: entry.id } });
    expect(sent.status).toBe('accepted');
    expect(sent.payload).toEqual(original);
    expect(vi.mocked(fakeFetch)).toHaveBeenCalledTimes(2);
    const calls = vi.mocked(fakeFetch).mock.calls;
    expect(calls[0][1]?.body).toEqual(calls[1][1]?.body);
    expect(new Headers(calls[0][1]?.headers).get('Idempotency-Key')).toBe(
      new Headers(calls[1][1]?.headers).get('Idempotency-Key'),
    );
  });
  it('holds ambiguous attempts outside the safe retry horizon instead of starting a new delivery', async () => {
    const id = await user();
    await subscribe(id);
    vi.mocked(fakeFetch).mockResolvedValueOnce(new Response('', { status: 503 }));
    await runMailing(catalog, texts, fakeFetch);
    vi.setSystemTime(+now + (23.1 * DAY) / 24);
    await runMailing(catalog, texts, fakeFetch);
    expect(vi.mocked(fakeFetch)).toHaveBeenCalledTimes(1);
    expect(
      (await db().emailDelivery.findFirstOrThrow({ where: { subscriptionId: (await sub(id)).id } }))
        .status,
    ).toBe('held');
  });
  it('stops retrying after six attempts and never sends on a disabled deployment', async () => {
    const id = await user();
    await subscribe(id);
    await db().emailDelivery.updateMany({
      where: { subscriptionId: (await sub(id)).id },
      data: { attempts: 6, firstAttemptAt: now, status: 'retry' },
    });
    await runMailing(catalog, texts, fakeFetch);
    expect(vi.mocked(fakeFetch)).not.toHaveBeenCalled();
    expect(
      (await db().emailDelivery.findFirstOrThrow({ where: { subscriptionId: (await sub(id)).id } }))
        .status,
    ).toBe('held');
    vi.stubEnv('EMAIL_ONBOARDING_ENABLED', 'false');
    expect(await runMailing(catalog, texts, fakeFetch)).toEqual({ queued: 0, examined: 0 });
  });
  it('rechecks unsubscribe before a queued retry', async () => {
    const id = await user();
    await activate(id);
    vi.mocked(fakeFetch).mockResolvedValueOnce(new Response('', { status: 503 }));
    await runMailing(catalog, texts, fakeFetch);
    await stopMailing(id);
    vi.setSystemTime(+now + 10 * 60 * 1000);
    await runMailing(catalog, texts, fakeFetch);
    expect(vi.mocked(fakeFetch)).toHaveBeenCalledTimes(1);
    expect((await sub(id)).status).toBe('unsubscribed');
  });
  it('verifies webhook signatures before trusting recipient or provider identifiers', async () => {
    const id = await user();
    await activate(id);
    await expect(
      handleMailingWebhook(
        JSON.stringify({ type: 'email.complained', data: { to: [`${id}@example.com`] } }),
        { 'svix-id': 'forged', 'svix-timestamp': '0', 'svix-signature': 'bad' },
      ),
    ).rejects.toMatchObject({ code: 'mailing_webhook_invalid' });
    expect((await sub(id)).status).toBe('active');
  });
  it('keeps complaints sticky across delivered replay and explicit resubscribe', async () => {
    const id = await user();
    await activate(id);
    await runMailing(catalog, texts, fakeFetch);
    const entry = await db().emailDelivery.findFirstOrThrow({
      where: { subscriptionId: (await sub(id)).id, kind: 'onboarding' },
    });
    for (const type of ['email.complained', 'email.delivered', 'email.complained']) {
      const e = webhook(type, { email_id: entry.providerId, to: [entry.recipient] });
      await handleMailingWebhook(e.raw, e.headers);
    }
    expect((await sub(id)).status).toBe('suppressed');
    expect((await db().emailDelivery.findUniqueOrThrow({ where: { id: entry.id } })).status).toBe(
      'complained',
    );
    await expect(subscribe(id)).rejects.toMatchObject({ code: 'mailing_suppressed' });
  });
  it('handles an authenticated bounce arriving before the provider response is persisted', async () => {
    const id = await user();
    await activate(id);
    vi.mocked(fakeFetch).mockImplementationOnce(async () => {
      const e = webhook('email.bounced', {
        email_id: `provider-race-${id}`,
        to: [`${id}@example.com`],
      });
      await handleMailingWebhook(e.raw, e.headers);
      return new Response(JSON.stringify({ id: `provider-race-${id}` }), { status: 200 });
    });
    await runMailing(catalog, texts, fakeFetch);
    expect((await sub(id)).status).toBe('suppressed');
    await runMailing(catalog, texts, fakeFetch);
    expect(vi.mocked(fakeFetch)).toHaveBeenCalledTimes(1);
  });

  it('records delivered receipts that arrive before the send response', async () => {
    const id = await user();
    await activate(id);
    vi.mocked(fakeFetch).mockImplementationOnce(async () => {
      const e = webhook('email.delivered', {
        email_id: `early-delivery-${id}`,
        to: [`${id}@example.com`],
      });
      await handleMailingWebhook(e.raw, new Headers(e.headers));
      return new Response(JSON.stringify({ id: `early-delivery-${id}` }), { status: 200 });
    });
    await runMailing(catalog, texts, fakeFetch);
    expect(
      (
        await db().emailDelivery.findFirstOrThrow({
          where: { subscriptionId: (await sub(id)).id, kind: 'onboarding' },
        })
      ).status,
    ).toBe('delivered');
  });
  it('does not suppress a newly confirmed address for a late bounce to the previous address', async () => {
    const id = await user();
    await activate(id);
    await runMailing(catalog, texts, fakeFetch);
    const old = await db().emailDelivery.findFirstOrThrow({
      where: { subscriptionId: (await sub(id)).id, kind: 'onboarding' },
    });
    await stopMailing(id);
    await db().user.update({ where: { id }, data: { email: `changed-${id}@example.com` } });
    vi.setSystemTime(+now + (2 * DAY) / 24);
    await subscribe(id);
    await confirmMailing(await token(id));
    const e = webhook('email.bounced', { email_id: old.providerId, to: [old.recipient] });
    await handleMailingWebhook(e.raw, e.headers);
    expect((await sub(id)).status).toBe('active');
    expect((await db().emailDelivery.findUniqueOrThrow({ where: { id: old.id } })).status).toBe(
      'bounced',
    );
  });
  it('sends a requested confirmation outside promotional hours', async () => {
    const id = await user();
    await requestMailing(id, { locale: 'es', timezone: 'Pacific/Honolulu' }, {}, texts);
    await runMailing(catalog, texts, fakeFetch);
    expect(vi.mocked(fakeFetch)).toHaveBeenCalledTimes(1);
  });
  it('measures pressure from late acceptance as well as the first attempt', async () => {
    const id = await user(2);
    await activate(id);
    const s = await sub(id);
    await db().emailDelivery.create({
      data: {
        subscriptionId: s.id,
        kind: 'onboarding',
        messageKey: 'd00',
        recipient: s.email,
        consentNonce: s.consentNonce,
        payload: {},
        expiresAt: new Date(+now + DAY),
        status: 'accepted',
        firstAttemptAt: new Date(+now - (25 * DAY) / 24),
        acceptedAt: new Date(+now - (2 * DAY) / 24),
      },
    });
    await runMailing(catalog, texts, fakeFetch);
    expect(vi.mocked(fakeFetch)).not.toHaveBeenCalled();
  });

  it('dispatches only the requested confirmation after response and never onboarding', async () => {
    const id = await user();
    await subscribe(id);
    await Promise.all([
      dispatchMailingConfirmation(id, fakeFetch),
      dispatchMailingConfirmation(id, fakeFetch),
    ]);
    expect(vi.mocked(fakeFetch)).toHaveBeenCalledTimes(1);
    expect(
      await db().emailDelivery.count({
        where: { subscriptionId: (await sub(id)).id, kind: 'onboarding' },
      }),
    ).toBe(0);
  });
  it('rechecks withdrawal after claim and before invoking transport', async () => {
    const id = await user();
    await activate(id);
    const original = db().$transaction.bind(db());
    type Transaction = (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => Promise<unknown>;
    let isWithdrawn = false;
    const intercept: Transaction = async (fn) => {
      const value = await (original as unknown as Transaction)(fn);
      if (
        !isWithdrawn &&
        value &&
        typeof value === 'object' &&
        'status' in value &&
        value.status === 'sending'
      ) {
        isWithdrawn = true;
        await stopMailing(id);
      }
      return value;
    };
    vi.spyOn(db(), '$transaction').mockImplementation(intercept as typeof original);
    await runMailing(catalog, texts, fakeFetch);
    expect(isWithdrawn).toBe(true);
    expect(vi.mocked(fakeFetch)).not.toHaveBeenCalled();
    expect((await sub(id)).status).toBe('unsubscribed');
  });
  it('reclaims an abandoned lease with the same idempotency key and ignores a stale worker response', async () => {
    const id = await user();
    await activate(id);
    let release: () => void = () => {};
    let began: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      began = resolve;
    });
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.mocked(fakeFetch)
      .mockImplementationOnce(async () => {
        began();
        await waiting;
        return new Response(JSON.stringify({ id: `stable-${id}` }), { status: 200 });
      })
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: `stable-${id}` }), { status: 200 }));
    const first = runMailing(catalog, texts, fakeFetch);
    await started;
    vi.setSystemTime(+now + 91_000);
    await runMailing(catalog, texts, fakeFetch);
    release();
    await first;
    const entry = await db().emailDelivery.findFirstOrThrow({
      where: { subscriptionId: (await sub(id)).id, kind: 'onboarding' },
    });
    expect(entry).toMatchObject({
      status: 'accepted',
      attempts: 2,
      providerId: `stable-${id}`,
      firstAttemptAt: now,
    });
    const calls = vi.mocked(fakeFetch).mock.calls;
    expect(calls[0][1]?.body).toEqual(calls[1][1]?.body);
    expect(new Headers(calls[0][1]?.headers).get('Idempotency-Key')).toBe(
      new Headers(calls[1][1]?.headers).get('Idempotency-Key'),
    );
  });
  it('pauses only recent render failures and resumes an eligible current slot', async () => {
    const id = await user(5);
    await activate(id);
    const render = await db().render.create({
      data: { userId: id, sourceKey: 'test', status: 'failed', updatedAt: now },
    });
    await runMailing(catalog, texts, fakeFetch);
    expect(vi.mocked(fakeFetch)).not.toHaveBeenCalled();
    await db().render.update({
      where: { id: render.id },
      data: { updatedAt: new Date(+now - (25 * DAY) / 24) },
    });
    await db().emailSubscription.update({ where: { userId: id }, data: { nextCheckAt: now } });
    await runMailing(catalog, texts, fakeFetch);
    expect(vi.mocked(fakeFetch)).toHaveBeenCalledTimes(1);
  });
  it('enforces seven-day pressure even when the last message is more than a day old', async () => {
    const id = await user(5);
    await activate(id);
    const s = await sub(id);
    for (let i = 0; i < 3; i++)
      await db().emailDelivery.create({
        data: {
          subscriptionId: s.id,
          kind: 'onboarding',
          messageKey: `prior-${i}`,
          recipient: s.email,
          consentNonce: s.consentNonce,
          payload: {},
          expiresAt: now,
          status: 'accepted',
          firstAttemptAt: new Date(+now - (i + 2) * DAY),
          acceptedAt: new Date(+now - (i + 2) * DAY),
        },
      });
    await runMailing(catalog, texts, fakeFetch);
    expect(vi.mocked(fakeFetch)).not.toHaveBeenCalled();
  });
  it.each(['email.failed', 'email.suppressed'])(
    'reconciles an early %s without losing its provider fact',
    async (type) => {
      const id = await user();
      await activate(id);
      const providerId = `early-${type}-${id}`;
      vi.mocked(fakeFetch).mockImplementationOnce(async () => {
        const e = webhook(type, {
          email_id: providerId,
          to: [`${id}@example.com`],
          ...(type === 'email.failed'
            ? { failed: { reason: 'reached_daily_quota' } }
            : {
                suppressed: { type: 'OnAccountSuppressionList', message: 'Provider suppression' },
              }),
        });
        await handleMailingWebhook(e.raw, e.headers);
        return new Response(JSON.stringify({ id: providerId }), { status: 200 });
      });
      await runMailing(catalog, texts, fakeFetch);
      const delivery = await db().emailDelivery.findFirstOrThrow({
        where: { subscriptionId: (await sub(id)).id, kind: 'onboarding' },
      });
      expect(delivery.status).toBe(type === 'email.failed' ? 'failed' : 'suppressed');
      expect(delivery.acceptedAt).toEqual(now);
      expect((await sub(id)).status).toBe(type === 'email.failed' ? 'active' : 'suppressed');
      expect(await db().emailProviderEvent.count({ where: { providerId, type } })).toBe(1);
    },
  );
  it('keeps provider suppression sticky across late delivered/failed replays and resubscribe', async () => {
    const id = await user();
    await activate(id);
    await runMailing(catalog, texts, fakeFetch);
    const delivery = await db().emailDelivery.findFirstOrThrow({
      where: { subscriptionId: (await sub(id)).id, kind: 'onboarding' },
    });
    const suppression = webhook('email.suppressed', {
      email_id: delivery.providerId,
      to: [delivery.recipient],
    });
    await handleMailingWebhook(suppression.raw, suppression.headers);
    await handleMailingWebhook(suppression.raw, suppression.headers);
    for (const type of ['email.delivered', 'email.failed']) {
      const e = webhook(type, { email_id: delivery.providerId, to: [delivery.recipient] });
      await handleMailingWebhook(e.raw, e.headers);
    }
    expect((await sub(id)).status).toBe('suppressed');
    expect(
      (await db().emailDelivery.findUniqueOrThrow({ where: { id: delivery.id } })).status,
    ).toBe('suppressed');
    expect(
      await db().emailProviderEvent.count({
        where: {
          providerId: delivery.providerId ?? 'missing-provider-id',
          type: 'email.suppressed',
        },
      }),
    ).toBe(1);
    await expect(subscribe(id)).rejects.toMatchObject({ code: 'mailing_suppressed' });
  });
  it('records a late failure without downgrading verified delivery or suppressing its subscriber', async () => {
    const id = await user();
    await activate(id);
    await runMailing(catalog, texts, fakeFetch);
    const delivery = await db().emailDelivery.findFirstOrThrow({
      where: { subscriptionId: (await sub(id)).id, kind: 'onboarding' },
    });
    for (const type of ['email.delivered', 'email.failed']) {
      const e = webhook(type, { email_id: delivery.providerId, to: [delivery.recipient] });
      await handleMailingWebhook(e.raw, e.headers);
    }
    expect(
      (await db().emailDelivery.findUniqueOrThrow({ where: { id: delivery.id } })).status,
    ).toBe('delivered');
    expect((await sub(id)).status).toBe('active');
    expect(
      await db().emailProviderEvent.count({
        where: { providerId: delivery.providerId ?? 'missing-provider-id', type: 'email.failed' },
      }),
    ).toBe(1);
  });
  it('records old-address provider suppression without suppressing the newly confirmed address', async () => {
    const id = await user();
    await activate(id);
    await runMailing(catalog, texts, fakeFetch);
    const old = await db().emailDelivery.findFirstOrThrow({
      where: { subscriptionId: (await sub(id)).id, kind: 'onboarding' },
    });
    await stopMailing(id);
    await db().user.update({ where: { id }, data: { email: `changed-${id}@example.com` } });
    vi.setSystemTime(+now + (2 * DAY) / 24);
    await subscribe(id);
    await confirmMailing(await token(id));
    const e = webhook('email.suppressed', { email_id: old.providerId, to: [old.recipient] });
    await handleMailingWebhook(e.raw, e.headers);
    expect((await sub(id)).status).toBe('active');
    expect((await db().emailDelivery.findUniqueOrThrow({ where: { id: old.id } })).status).toBe(
      'suppressed',
    );
  });
});
