import { randomUUID } from 'node:crypto';
import { db, type EmailDelivery, type EmailSubscription, type Prisma } from '@easyrender/db';
import { Webhook } from 'svix';
import { AppError } from '../errors';
import {
  currentSlot,
  DAY,
  hasCapacity,
  isLessonEligible,
  isSendingHour,
  MAILING_ROUTES,
  MAILING_VERSION,
  type MailingCatalog,
  type MailingLocale,
  type MailingRoute,
} from './policy';
import { makeMailToken, readMailToken } from './security';
import type { MailingSystemCopy } from './transport';
import {
  buildMailPayload,
  type MailPayload,
  mailingConfig,
  recipientAllowed,
  sendMail,
} from './transport';

type Tx = Prisma.TransactionClient;
const HOUR = DAY / 24;
const PROVIDER_EVENTS = [
  'email.delivered',
  'email.bounced',
  'email.complained',
  'email.failed',
  'email.suppressed',
];
const SUPPRESSION_EVENTS = ['email.bounced', 'email.complained', 'email.suppressed'];
const secret = () => process.env.EMAIL_TOKEN_SECRET ?? '';
const sameAddress = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
async function lockUser(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${id} FOR UPDATE`;
}
async function cancelPending(tx: Tx, id: string) {
  await tx.emailDelivery.updateMany({
    where: { subscriptionId: id, status: { in: ['pending', 'sending', 'retry'] } },
    data: { status: 'cancelled' },
  });
}
function links(s: EmailSubscription, appUrl: string) {
  const suffix = `&locale=${s.locale === 'es' ? 'es' : 'en'}`;
  return {
    unsubscribe: `${appUrl}/email/unsubscribe?token=${encodeURIComponent(makeMailToken(s.id, s.unsubscribeNonce, 'unsubscribe', secret()))}${suffix}`,
    preferences: `${appUrl}/account`,
    confirm: `${appUrl}/email/confirm?token=${encodeURIComponent(makeMailToken(s.id, s.consentNonce, 'confirm', secret()))}${suffix}`,
  };
}
export function mailingAvailable(): boolean {
  return Boolean(mailingConfig());
}
export async function mailingStatus(
  userId: string,
): Promise<{ status: string; locale: string | null; expiresAt: string; isAvailable: boolean }> {
  const user = await db().user.findUnique({
    where: { id: userId },
    include: { emailSubscription: true },
  });
  if (!user) throw new AppError('Account not found', 404, 'not_found');
  const s = user.emailSubscription;
  const expiresAt = new Date(+user.createdAt + 30 * DAY);
  const status =
    s && !sameAddress(s.email, user.email)
      ? 'held'
      : +expiresAt <= Date.now()
        ? 'expired'
        : (s?.status ?? 'none');
  return {
    status,
    locale: s?.locale ?? null,
    expiresAt: expiresAt.toISOString(),
    isAvailable:
      mailingAvailable() &&
      recipientAllowed(user.email) &&
      +expiresAt > Date.now() &&
      s?.status !== 'suppressed',
  };
}
export async function requestMailing(
  userId: string,
  input: { locale: MailingLocale; timezone: string },
  originMap: Record<string, MailingRoute>,
  texts: Record<MailingLocale, MailingSystemCopy>,
): Promise<void> {
  const config = mailingConfig();
  if (!config) throw new AppError('Mailing unavailable', 503, 'mailing_unavailable');
  if (!['es', 'en'].includes(input.locale))
    throw new AppError('Unsupported language', 400, 'mailing_input');
  try {
    new Intl.DateTimeFormat('en', { timeZone: input.timezone }).format();
  } catch {
    throw new AppError('Invalid timezone', 400, 'mailing_input');
  }
  await db().$transaction(async (tx) => {
    await lockUser(tx, userId);
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: { emailSubscription: true },
    });
    if (!user) throw new AppError('Account not found', 404, 'not_found');
    const now = new Date();
    const expiresAt = new Date(+user.createdAt + 30 * DAY);
    if (+expiresAt <= +now)
      throw new AppError('Registration program ended', 409, 'mailing_expired');
    if (!recipientAllowed(user.email))
      throw new AppError('Mailing unavailable', 503, 'mailing_unavailable');
    const old = user.emailSubscription;
    if (old?.status === 'suppressed')
      throw new AppError('Address suppressed', 409, 'mailing_suppressed');
    if (old?.status === 'active' && sameAddress(old.email, user.email)) return;
    if (old && +now - +old.requestedAt < HOUR)
      throw new AppError(
        'Wait before requesting another confirmation',
        429,
        'mailing_rate_limited',
      );
    if (
      old &&
      (await tx.emailConsentEvent.count({
        where: {
          subscriptionId: old.id,
          event: 'requested',
          occurredAt: { gt: new Date(+now - DAY) },
        },
      })) >= 3
    )
      throw new AppError('Confirmation request limit reached', 429, 'mailing_rate_limited');
    if (old) await cancelPending(tx, old.id);
    const candidate = originMap[(user.landing_path ?? '').split('?')[0]];
    const route = MAILING_ROUTES.includes(candidate) ? candidate : 'general';
    const values = {
      email: user.email,
      locale: input.locale,
      timezone: input.timezone,
      route,
      status: 'pending',
      consentVersion: MAILING_VERSION,
      consentNonce: randomUUID(),
      requestedAt: now,
      confirmExpiresAt: new Date(Math.min(+expiresAt, +now + DAY)),
      expiresAt,
      confirmedAt: null,
      isPaused: false,
      nextCheckAt: now,
    };
    const s = old
      ? await tx.emailSubscription.update({ where: { id: old.id }, data: values })
      : await tx.emailSubscription.create({
          data: { ...values, userId, unsubscribeNonce: randomUUID() },
        });
    const text = texts[input.locale];
    const payload = buildMailPayload(
      {
        subject: text.confirmSubject,
        preheader: '',
        body: text.confirmBody,
        action: text.confirmAction,
      },
      s.email,
      links(s, config.appUrl),
      text,
    );
    await tx.emailDelivery.create({
      data: {
        subscriptionId: s.id,
        kind: 'confirmation',
        messageKey: s.consentNonce,
        payload,
        recipient: s.email,
        consentNonce: s.consentNonce,
        expiresAt: s.confirmExpiresAt,
        nextAttemptAt: now,
      },
    });
    await tx.emailConsentEvent.create({
      data: {
        subscriptionId: s.id,
        event: 'requested',
        version: s.consentVersion,
        occurredAt: now,
      },
    });
  });
}
export async function stopMailing(userId: string): Promise<void> {
  await db().$transaction(async (tx) => {
    await lockUser(tx, userId);
    const s = await tx.emailSubscription.findUnique({ where: { userId } });
    if (!s) return;
    if (s.status !== 'unsubscribed' && s.status !== 'suppressed') {
      await tx.emailSubscription.update({ where: { id: s.id }, data: { status: 'unsubscribed' } });
      await tx.emailConsentEvent.create({
        data: { subscriptionId: s.id, event: 'unsubscribed', version: s.consentVersion },
      });
    }
    await cancelPending(tx, s.id);
  });
}
export async function confirmMailing(token: string): Promise<boolean> {
  const value = readMailToken(token, 'confirm', secret());
  if (!value) return false;
  const found = await db().emailSubscription.findUnique({ where: { id: value.id } });
  if (!found) return false;
  return db().$transaction(async (tx) => {
    await lockUser(tx, found.userId);
    const s = await tx.emailSubscription.findUnique({
      where: { id: value.id },
      include: { user: true },
    });
    const now = new Date();
    if (
      !s ||
      s.consentNonce !== value.nonce ||
      !sameAddress(s.email, s.user.email) ||
      +s.expiresAt <= +now ||
      +s.user.createdAt + 30 * DAY <= +now
    )
      return false;
    if (s.status === 'active') return true;
    if (s.status !== 'pending' || +s.confirmExpiresAt <= +now) return false;
    await tx.emailSubscription.update({
      where: { id: s.id },
      data: { status: 'active', confirmedAt: now, nextCheckAt: now },
    });
    await tx.emailConsentEvent.create({
      data: {
        subscriptionId: s.id,
        event: 'confirmed',
        version: s.consentVersion,
        occurredAt: now,
      },
    });
    await tx.emailDelivery.updateMany({
      where: {
        subscriptionId: s.id,
        kind: 'confirmation',
        status: { in: ['pending', 'retry', 'sending'] },
      },
      data: { status: 'cancelled' },
    });
    return true;
  });
}
export async function unsubscribeMailing(token: string): Promise<boolean> {
  const value = readMailToken(token, 'unsubscribe', secret());
  if (!value) return false;
  const found = await db().emailSubscription.findUnique({ where: { id: value.id } });
  if (!found || found.unsubscribeNonce !== value.nonce) return false;
  await stopMailing(found.userId);
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
async function suppressSubscription(tx: Tx, s: EmailSubscription, event: string) {
  if (s.status !== 'suppressed') {
    await tx.emailSubscription.update({ where: { id: s.id }, data: { status: 'suppressed' } });
    await tx.emailConsentEvent.create({
      data: { subscriptionId: s.id, event, version: s.consentVersion },
    });
  }
  await cancelPending(tx, s.id);
}
async function reconcileProviderFacts(tx: Tx, id: string) {
  const delivery = await tx.emailDelivery.findUnique({
    where: { id },
    include: { subscription: { include: { user: true } } },
  });
  if (!delivery?.providerId) return;
  const events = await tx.emailProviderEvent.findMany({
    where: { providerId: delivery.providerId },
    orderBy: { occurredAt: 'asc' },
  });
  const deliveredAt =
    delivery.deliveredAt ?? events.find((e) => e.type === 'email.delivered')?.occurredAt ?? null;
  const bouncedAt =
    delivery.bouncedAt ?? events.find((e) => e.type === 'email.bounced')?.occurredAt ?? null;
  const complainedAt =
    delivery.complainedAt ?? events.find((e) => e.type === 'email.complained')?.occurredAt ?? null;
  const isSuppressed =
    delivery.status === 'suppressed' || events.some((event) => event.type === 'email.suppressed');
  const hasFailed =
    delivery.status === 'failed' || events.some((event) => event.type === 'email.failed');
  const status = complainedAt
    ? 'complained'
    : bouncedAt
      ? 'bounced'
      : isSuppressed
        ? 'suppressed'
        : deliveredAt
          ? 'delivered'
          : hasFailed
            ? 'failed'
            : delivery.status;
  await tx.emailDelivery.update({
    where: { id },
    data: {
      deliveredAt,
      bouncedAt,
      complainedAt,
      status,
      ...(status === 'failed'
        ? { lastError: 'provider_failed' }
        : status === 'suppressed'
          ? { lastError: 'provider_suppressed' }
          : status === 'delivered'
            ? { lastError: null }
            : {}),
    },
  });
  const s = delivery.subscription;
  if (
    (bouncedAt || complainedAt || isSuppressed) &&
    sameAddress(delivery.recipient, s.email) &&
    sameAddress(s.email, s.user.email)
  )
    await suppressSubscription(
      tx,
      s,
      complainedAt ? 'complained' : bouncedAt ? 'bounced' : 'provider_suppressed',
    );
}
export async function handleMailingWebhook(
  raw: string,
  headers: Headers | Record<string, string>,
): Promise<void> {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const normalized = headers instanceof Headers ? Object.fromEntries(headers.entries()) : headers;
  let value: unknown;
  try {
    if (!webhookSecret || raw.length > 262144) throw new Error('Invalid webhook');
    new Webhook(webhookSecret).verify(raw, normalized);
    value = JSON.parse(raw);
  } catch {
    throw new AppError('Invalid webhook signature', 400, 'mailing_webhook_invalid');
  }
  if (!isRecord(value) || !isRecord(value.data)) return;
  const type = value.type;
  if (typeof type !== 'string' || !PROVIDER_EVENTS.includes(type)) return;
  const data = value.data;
  const providerId = typeof data.email_id === 'string' ? data.email_id : null;
  const eventId = normalized['svix-id'];
  if (!providerId || providerId.length > 200 || !eventId || eventId.length > 200) return;
  const parsedAt = typeof value.created_at === 'string' ? new Date(value.created_at) : new Date();
  const occurredAt = Number.isFinite(+parsedAt) ? parsedAt : new Date();
  const receipt = await db().emailProviderEvent.upsert({
    where: { id: eventId },
    update: {},
    create: { id: eventId, providerId, type, occurredAt },
  });
  const known = await db().emailDelivery.findUnique({
    where: { providerId: receipt.providerId },
    include: { subscription: true },
  });
  if (known) {
    await db().$transaction(async (tx) => {
      await lockUser(tx, known.subscription.userId);
      await reconcileProviderFacts(tx, known.id);
    });
    return;
  }
  if (!SUPPRESSION_EVENTS.includes(receipt.type)) return;
  // A signed suppression may precede the send response. Match only recipients already attempted.
  const recipients = Array.isArray(data.to)
    ? data.to.filter((v): v is string => typeof v === 'string' && v.length <= 320).slice(0, 10)
    : [];
  if (!recipients.length) return;
  const candidates = await db().emailDelivery.findMany({
    where: {
      OR: recipients.map((recipient) => ({
        recipient: { equals: recipient, mode: 'insensitive' },
      })),
      firstAttemptAt: { not: null },
    },
    include: { subscription: true },
    take: 50,
  });
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate.subscriptionId)) continue;
    seen.add(candidate.subscriptionId);
    await db().$transaction(async (tx) => {
      await lockUser(tx, candidate.subscription.userId);
      const s = await tx.emailSubscription.findUnique({
        where: { id: candidate.subscriptionId },
        include: { user: true },
      });
      if (s && sameAddress(candidate.recipient, s.email) && sameAddress(s.email, s.user.email))
        await suppressSubscription(
          tx,
          s,
          receipt.type === 'email.complained'
            ? 'complained'
            : receipt.type === 'email.bounced'
              ? 'bounced'
              : 'provider_suppressed',
        );
    });
  }
}
async function isCurrentSubscription(
  tx: Tx,
  s: EmailSubscription,
  user: { email: string; createdAt: Date },
  now: Date,
) {
  let status: string | null = null;
  if (!sameAddress(s.email, user.email)) status = 'held';
  else if (+s.expiresAt <= +now || +user.createdAt + 30 * DAY <= +now) status = 'expired';
  if (status) {
    if (s.status !== 'suppressed' && s.status !== 'unsubscribed')
      await tx.emailSubscription.update({ where: { id: s.id }, data: { status } });
    await cancelPending(tx, s.id);
    return false;
  }
  return !['suppressed', 'unsubscribed', 'expired', 'held'].includes(s.status);
}
async function activity(tx: Tx, userId: string, now: Date) {
  const task = await tx.render.findFirst({ where: { userId }, select: { id: true } });
  const result = await tx.render.findFirst({
    where: { userId, status: 'ready', glbKey: { not: null } },
    select: { id: true },
  });
  const interruption = await tx.render.findFirst({
    where: {
      userId,
      OR: [
        { status: { in: ['drafting', 'rendering'] } },
        { status: 'failed', updatedAt: { gt: new Date(+now - DAY) } },
      ],
    },
    select: { id: true },
  });
  return {
    hasTask: Boolean(task),
    hasResult: Boolean(result),
    hasInterruption: Boolean(interruption),
  };
}
async function hasPressureCapacity(tx: Tx, subscriptionId: string, now: Date, exceptId?: string) {
  const window = new Date(+now - 30 * DAY);
  const history = await tx.emailDelivery.findMany({
    where: {
      subscriptionId,
      kind: 'onboarding',
      OR: [{ firstAttemptAt: { gt: window } }, { acceptedAt: { gt: window } }],
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { firstAttemptAt: true, acceptedAt: true },
  });
  return hasCapacity(
    history.flatMap((r) =>
      r.acceptedAt ? [r.acceptedAt] : r.firstAttemptAt ? [r.firstAttemptAt] : [],
    ),
    now,
  );
}
async function queueSubscription(
  id: string,
  catalog: MailingCatalog,
  texts: Record<MailingLocale, MailingSystemCopy>,
) {
  const found = await db().emailSubscription.findUnique({ where: { id } });
  if (!found) return false;
  return db().$transaction(async (tx) => {
    await lockUser(tx, found.userId);
    const s = await tx.emailSubscription.findUnique({ where: { id }, include: { user: true } });
    if (!s) return false;
    const now = new Date();
    await tx.emailSubscription.update({
      where: { id },
      data: { nextCheckAt: new Date(+now + 15 * 60 * 1000) },
    });
    if (
      !(await isCurrentSubscription(tx, s, s.user, now)) ||
      s.status !== 'active' ||
      !s.confirmedAt ||
      s.isPaused ||
      !isSendingHour(s.timezone, now)
    )
      return false;
    const config = mailingConfig();
    if (!config || !recipientAllowed(s.email)) return false;
    const day = currentSlot(s.user.createdAt, now);
    if (day === null) return false;
    const key = `d${String(day).padStart(2, '0')}`;
    const messageId = `${s.route}_${key}`;
    const state = await activity(tx, s.userId, now);
    if (
      state.hasInterruption ||
      !isLessonEligible(messageId, state) ||
      !(await hasPressureCapacity(tx, s.id, now))
    )
      return false;
    const locale = s.locale === 'es' ? 'es' : 'en';
    const copy = catalog[locale]?.[messageId];
    if (!copy) return false;
    const existing = await tx.emailDelivery.findUnique({
      where: {
        subscriptionId_kind_messageKey: {
          subscriptionId: s.id,
          kind: 'onboarding',
          messageKey: key,
        },
      },
    });
    if (existing) return false;
    const urls = links(s, config.appUrl);
    const payload = buildMailPayload(
      copy,
      s.email,
      { unsubscribe: urls.unsubscribe, preferences: urls.preferences },
      texts[locale],
    );
    await tx.emailDelivery.create({
      data: {
        subscriptionId: s.id,
        kind: 'onboarding',
        messageKey: key,
        payload,
        recipient: s.email,
        consentNonce: s.consentNonce,
        expiresAt: new Date(Math.min(+s.expiresAt, +s.user.createdAt + (day + 1) * DAY)),
        nextAttemptAt: now,
      },
    });
    return true;
  });
}
const OUTBOX_STATUSES = ['pending', 'retry', 'sending'];
async function claimDelivery(id: string) {
  const found = await db().emailDelivery.findUnique({
    where: { id },
    include: { subscription: true },
  });
  if (!found) return null;
  return db().$transaction(async (tx) => {
    await lockUser(tx, found.subscription.userId);
    const entry = await tx.emailDelivery.findUnique({
      where: { id },
      include: { subscription: { include: { user: true } } },
    });
    if (!entry) return null;
    const s = entry.subscription;
    const now = new Date();
    if (
      !OUTBOX_STATUSES.includes(entry.status) ||
      +entry.nextAttemptAt > +now ||
      (entry.leaseUntil && +entry.leaseUntil > +now)
    )
      return null;
    const isRetryExpired = entry.firstAttemptAt && +now - +entry.firstAttemptAt >= 23 * HOUR;
    if (entry.attempts >= 6 || isRetryExpired || +entry.expiresAt <= +now) {
      await tx.emailDelivery.update({
        where: { id },
        data: {
          status: entry.firstAttemptAt ? 'held' : 'expired',
          leaseToken: null,
          leaseUntil: null,
          lastError: 'send_window_ended',
        },
      });
      return null;
    }
    if (!(await isCurrentSubscription(tx, s, s.user, now))) return null;
    const isConfirmation = entry.kind === 'confirmation';
    if (
      !sameAddress(entry.recipient, s.email) ||
      entry.consentNonce !== s.consentNonce ||
      (isConfirmation
        ? s.status !== 'pending' || +s.confirmExpiresAt <= +now
        : s.status !== 'active' || !s.confirmedAt)
    ) {
      await tx.emailDelivery.update({ where: { id }, data: { status: 'cancelled' } });
      return null;
    }
    const config = mailingConfig();
    const state = isConfirmation ? null : await activity(tx, s.userId, now);
    const messageId = `${s.route}_${entry.messageKey}`;
    if (
      !config ||
      !recipientAllowed(entry.recipient) ||
      s.isPaused ||
      (!isConfirmation && !isSendingHour(s.timezone, now)) ||
      state?.hasInterruption ||
      (state && !isLessonEligible(messageId, state)) ||
      (!isConfirmation && !(await hasPressureCapacity(tx, s.id, now, id)))
    ) {
      await tx.emailDelivery.update({
        where: { id },
        data: {
          status: entry.firstAttemptAt ? 'retry' : 'pending',
          nextAttemptAt: new Date(+now + 15 * 60 * 1000),
          leaseToken: null,
          leaseUntil: null,
        },
      });
      return null;
    }
    const leaseToken = randomUUID();
    const claimed = await tx.emailDelivery.update({
      where: { id },
      data: {
        status: 'sending',
        leaseToken,
        leaseUntil: new Date(+now + 90 * 1000),
        firstAttemptAt: entry.firstAttemptAt ?? now,
        lastAttemptAt: now,
        attempts: { increment: 1 },
      },
    });
    return claimed;
  });
}
async function finishDelivery(entry: EmailDelivery, result: Awaited<ReturnType<typeof sendMail>>) {
  const found = await db().emailSubscription.findUnique({ where: { id: entry.subscriptionId } });
  if (!found) return;
  await db().$transaction(async (tx) => {
    await lockUser(tx, found.userId);
    const current = await tx.emailDelivery.findUnique({ where: { id: entry.id } });
    if (!current || current.leaseToken !== entry.leaseToken) return;
    const now = new Date();
    const isAccepted = result.status === 'accepted' && Boolean(result.providerId);
    const isTerminal = [
      'cancelled',
      'delivered',
      'bounced',
      'complained',
      'suppressed',
      'failed',
    ].includes(current.status);
    const isHeld =
      entry.attempts >= 6 ||
      (entry.firstAttemptAt && +now - +entry.firstAttemptAt >= 23 * HOUR) ||
      +entry.expiresAt <= +now;
    const status = isTerminal
      ? current.status
      : isAccepted
        ? 'accepted'
        : result.status === 'failed'
          ? 'failed'
          : isHeld
            ? 'held'
            : 'retry';
    await tx.emailDelivery.update({
      where: { id: entry.id },
      data: {
        status,
        leaseToken: null,
        leaseUntil: null,
        ...(isAccepted
          ? { providerId: result.providerId, acceptedAt: current.acceptedAt ?? now }
          : {}),
        lastError: isAccepted
          ? null
          : result.status === 'failed'
            ? 'provider_rejected'
            : 'provider_uncertain',
        nextAttemptAt: new Date(+now + Math.min(HOUR, 60_000 * 2 ** Math.min(entry.attempts, 6))),
      },
    });
    if (isAccepted) await reconcileProviderFacts(tx, entry.id);
  });
}
async function dispatchEntry(id: string, fetcher: typeof fetch) {
  const entry = await claimDelivery(id);
  if (!entry) return false;
  // One final read after the claim transaction: withdrawal/address changes must stop queued work.
  const latest = await db().emailDelivery.findUnique({
    where: { id },
    include: { subscription: { include: { user: true } } },
  });
  const now = new Date();
  const s = latest?.subscription;
  const isConfirmation = entry.kind === 'confirmation';
  const canSend =
    latest?.status === 'sending' &&
    latest.leaseToken === entry.leaseToken &&
    s &&
    !s.isPaused &&
    sameAddress(s.email, s.user.email) &&
    sameAddress(entry.recipient, s.email) &&
    s.consentNonce === entry.consentNonce &&
    +entry.expiresAt > +now &&
    +s.expiresAt > +now &&
    +s.user.createdAt + 30 * DAY > +now &&
    (isConfirmation
      ? s.status === 'pending' && +s.confirmExpiresAt > +now
      : s.status === 'active' && Boolean(s.confirmedAt) && isSendingHour(s.timezone, now)) &&
    mailingConfig() &&
    recipientAllowed(entry.recipient);
  if (!canSend) {
    await db().emailDelivery.updateMany({
      where: { id, leaseToken: entry.leaseToken, status: 'sending' },
      data: {
        status: 'cancelled',
        leaseToken: null,
        leaseUntil: null,
        lastError: 'eligibility_changed',
      },
    });
    return false;
  }
  let result: Awaited<ReturnType<typeof sendMail>>;
  try {
    result = await sendMail(entry.payload as MailPayload, entry.id, fetcher);
  } catch {
    result = { status: 'retry' };
  }
  await finishDelivery(entry, result);
  return true;
}
export async function dispatchMailingConfirmation(
  userId: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  if (!mailingConfig()) return;
  const s = await db().emailSubscription.findUnique({ where: { userId } });
  if (s?.status !== 'pending') return;
  const entry = await db().emailDelivery.findFirst({
    where: {
      subscriptionId: s.id,
      kind: 'confirmation',
      consentNonce: s.consentNonce,
      status: { in: OUTBOX_STATUSES },
      nextAttemptAt: { lte: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (entry) await dispatchEntry(entry.id, fetcher);
}
export async function runMailing(
  catalog: MailingCatalog,
  texts: Record<MailingLocale, MailingSystemCopy>,
  fetcher: typeof fetch = fetch,
): Promise<{ queued: number; examined: number }> {
  if (!mailingConfig()) return { queued: 0, examined: 0 };
  const deadline = Date.now() + 30_000;
  let queued = 0;
  let examined = 0;
  const subscriptions = await db().emailSubscription.findMany({
    where: { status: 'active', nextCheckAt: { lte: new Date() } },
    orderBy: [{ nextCheckAt: 'asc' }, { id: 'asc' }],
    take: 50,
    select: { id: true },
  });
  for (const s of subscriptions) {
    if (Date.now() >= deadline - 5000) break;
    if (await queueSubscription(s.id, catalog, texts)) queued++;
  }
  const now = new Date();
  const pending = await db().emailDelivery.findMany({
    where: {
      status: { in: OUTBOX_STATUSES },
      nextAttemptAt: { lte: now },
      OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
    },
    orderBy: [{ nextAttemptAt: 'asc' }, { id: 'asc' }],
    take: 10,
    select: { id: true },
  });
  for (const item of pending) {
    if (Date.now() >= deadline - 5000) break;
    if (await dispatchEntry(item.id, fetcher)) examined++;
  }
  return { queued, examined };
}
