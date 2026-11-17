import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { db, type Prisma, type ServiceEmailDelivery } from '@easyrender/db';
import { Webhook } from 'svix';
import { AppError } from './errors';
import { buildServiceMailPayload, type ServiceEmailCopy } from './mailing/service-template';
import {
  type MailPayload,
  resendConfig,
  resendRecipientAllowed,
  sendResendMail,
} from './mailing/transport';

export type { ServiceEmailCopy } from './mailing/service-template';
export type ServiceEmailTexts = Record<
  'en' | 'es',
  Record<'render_ready' | 'render_failed', ServiceEmailCopy>
>;
export type ServiceEmailInput = {
  purpose: 'verify_email' | 'reset_password';
  userId: string;
  email: string;
  url: string;
  expiresAt: Date;
  locale?: 'en' | 'es';
  copy: ServiceEmailCopy;
};
const HOUR = 3600000;
const pending = ['queued', 'retry', 'sending'];
const eventTypes = [
  'email.delivered',
  'email.failed',
  'email.bounced',
  'email.complained',
  'email.suppressed',
];
const suppressionTypes = ['email.bounced', 'email.complained', 'email.suppressed'];
const normalized = (email: string) => email.trim().toLowerCase();
function serviceConfig() {
  const base = resendConfig();
  const secret = process.env.SERVICE_EMAIL_ENCRYPTION_SECRET ?? '';
  return base && process.env.SERVICE_EMAIL_ENABLED === 'true' && secret.length >= 32
    ? { ...base, secret }
    : null;
}
export function serviceEmailAvailable(): boolean {
  return Boolean(serviceConfig());
}
function unavailable(): never {
  throw new AppError('Service email is unavailable', 503, 'service_email_unavailable');
}
function seal(payload: MailPayload, secret: string, aad: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), iv);
  cipher.setAAD(Buffer.from(aad));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}
function unseal(value: string, secret: string, aad: string): MailPayload {
  const [version, iv, tag, data] = value.split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Invalid service email envelope');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    createHash('sha256').update(secret).digest(),
    Buffer.from(iv, 'base64url'),
  );
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return JSON.parse(
    Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString(
      'utf8',
    ),
  ) as MailPayload;
}
const aad = (entry: Pick<ServiceEmailDelivery, 'id' | 'purpose' | 'email'>) =>
  `${entry.id}:${entry.purpose}:${entry.email}`;
function buildPayload(email: string, url: string, copy: ServiceEmailCopy): MailPayload {
  const config = serviceConfig();
  if (!config) return unavailable();
  return buildServiceMailPayload(email, url, copy, config);
}
async function isSuppressed(tx: Prisma.TransactionClient, email: string): Promise<boolean> {
  return (
    Boolean(await tx.serviceEmailSuppression.findUnique({ where: { email: normalized(email) } })) ||
    Boolean(
      await tx.emailSubscription.findFirst({
        where: { email, status: 'suppressed' },
        select: { id: true },
      }),
    )
  );
}
/** Queue only the server's explicit authentication request; never sends on this request path. */
export async function queueServiceEmail(input: ServiceEmailInput): Promise<void> {
  const config = serviceConfig();
  if (!config || !resendRecipientAllowed(input.email)) return unavailable();
  const url = new URL(input.url);
  const isAuthPath =
    input.purpose === 'verify_email'
      ? url.pathname === '/verify-email'
      : url.pathname === '/reset-password';
  if (
    !isAuthPath ||
    url.origin !== config.appUrl ||
    !Number.isFinite(+input.expiresAt) ||
    +input.expiresAt <= Date.now() ||
    +input.expiresAt > Date.now() + 24 * HOUR
  )
    throw new AppError('Invalid service email request', 400, 'invalid_service_email');
  const dedupeKey = createHash('sha256')
    .update(`${input.userId}:${input.purpose}:${input.url}`)
    .digest('hex');
  await db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${input.userId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: input.userId } });
    if (!user || user.email !== input.email)
      throw new AppError('Invalid service email recipient', 400, 'invalid_service_email');
    if (await isSuppressed(tx, user.email)) return unavailable();
    if (input.purpose === 'verify_email' && user.emailVerified) return;
    if (await tx.serviceEmailDelivery.findUnique({ where: { dedupeKey } })) return;
    // The user lock serializes requests across instances. The address lock also covers distinct
    // accounts whose stored email differs only in casing. All statuses count, including superseded.
    const recipientKey = createHash('sha256')
      .update(`service-email-rate:${normalized(user.email)}:${input.purpose}`)
      .digest()
      .readBigInt64BE();
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${recipientKey})`;
    const recent = await tx.serviceEmailDelivery.count({
      where: {
        email: { equals: normalized(user.email), mode: 'insensitive' },
        purpose: input.purpose,
        createdAt: { gt: new Date(Date.now() - HOUR) },
      },
    });
    if (recent >= 3)
      throw new AppError('Too many service email requests', 429, 'service_email_rate_limited');
    const id = randomUUID();
    const entry = { id, purpose: input.purpose, email: input.email };
    await tx.serviceEmailDelivery.updateMany({
      where: { userId: user.id, purpose: input.purpose, status: { in: ['queued', 'retry'] } },
      data: { status: 'cancelled', payloadEncrypted: null, lastError: 'superseded' },
    });
    await tx.serviceEmailDelivery.create({
      data: {
        ...entry,
        userId: user.id,
        dedupeKey,
        locale: input.locale ?? 'en',
        expiresAt: input.expiresAt,
        createdAt: new Date(),
        nextAttemptAt: new Date(),
        payloadEncrypted: seal(
          buildPayload(input.email, input.url, input.copy),
          config.secret,
          aad(entry),
        ),
      },
    });
  });
}
/** Called only inside the transaction committing a newly observed terminal render. No backfill scan. */
export async function queueRenderServiceEmail(
  renderId: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  if (!serviceConfig()) return;
  const render = await tx.render.findUnique({ where: { id: renderId }, include: { user: true } });
  if (
    !render?.user?.emailVerified ||
    !resendRecipientAllowed(render.user.email) ||
    (render.status !== 'ready' && render.status !== 'failed') ||
    (render.status === 'ready' && !render.glbKey)
  )
    return;
  if (await isSuppressed(tx, render.user.email)) return;
  const purpose = render.status === 'ready' ? 'render_ready' : 'render_failed';
  const locale = /^\/es(?:\/|$)/.test(render.landing_path ?? render.user.landing_path ?? '')
    ? 'es'
    : 'en';
  const dedupeKey = `render:${render.id}:${purpose}`;
  await tx.serviceEmailDelivery.upsert({
    where: { dedupeKey },
    update: {},
    create: {
      userId: render.user.id,
      email: render.user.email,
      purpose,
      renderId,
      locale,
      dedupeKey,
      expiresAt: new Date(Date.now() + 24 * HOUR),
      nextAttemptAt: new Date(),
    },
  });
}
async function eligible(
  tx: Prisma.TransactionClient,
  entry: ServiceEmailDelivery,
): Promise<boolean> {
  if (!serviceConfig() || !resendRecipientAllowed(entry.email) || +entry.expiresAt <= Date.now())
    return false;
  const user = await tx.user.findUnique({ where: { id: entry.userId } });
  if (!user || user.email !== entry.email || (await isSuppressed(tx, entry.email))) return false;
  if (entry.purpose === 'verify_email') return !user.emailVerified;
  if (entry.purpose === 'reset_password') return true;
  if (!user.emailVerified || !entry.renderId) return false;
  const render = await tx.render.findFirst({ where: { id: entry.renderId, userId: user.id } });
  return Boolean(
    render &&
      (entry.purpose === 'render_ready'
        ? render.status === 'ready' && render.glbKey
        : entry.purpose === 'render_failed' && render.status === 'failed'),
  );
}
async function reconcile(tx: Prisma.TransactionClient, id: string): Promise<void> {
  const entry = await tx.serviceEmailDelivery.findUnique({ where: { id } });
  if (!entry?.providerId) return;
  const events = await tx.emailProviderEvent.findMany({ where: { providerId: entry.providerId } });
  const priority = [
    'email.complained',
    'email.bounced',
    'email.suppressed',
    'email.delivered',
    'email.failed',
  ];
  const event = priority.map((type) => events.find((e) => e.type === type)).find(Boolean);
  if (!event) return;
  const status = event.type.slice(6);
  if (suppressionTypes.includes(event.type))
    await tx.serviceEmailSuppression.upsert({
      where: { email: normalized(entry.email) },
      create: { email: normalized(entry.email), reason: status },
      update: {},
    });
  await tx.serviceEmailDelivery.update({
    where: { id },
    data: {
      status,
      deliveredAt: events.find((e) => e.type === 'email.delivered')?.occurredAt,
      leaseToken: null,
      leaseUntil: null,
      payloadEncrypted: null,
      lastError: status === 'delivered' ? null : `provider_${status}`,
    },
  });
}
export async function handleServiceEmailWebhook(
  raw: string,
  headers: Headers | Record<string, string>,
): Promise<void> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) throw new AppError('Webhook unavailable', 503, 'webhook_unavailable');
  const h = headers instanceof Headers ? Object.fromEntries(headers.entries()) : headers;
  let event: unknown;
  try {
    if (raw.length > 262144) throw new Error('Oversize event');
    new Webhook(secret).verify(raw, h);
    event = JSON.parse(raw);
  } catch {
    throw new AppError('Invalid email webhook signature', 400, 'service_email_webhook_invalid');
  }
  if (
    !event ||
    typeof event !== 'object' ||
    !('type' in event) ||
    typeof event.type !== 'string' ||
    !eventTypes.includes(event.type) ||
    !('data' in event) ||
    !event.data ||
    typeof event.data !== 'object' ||
    !('email_id' in event.data) ||
    typeof event.data.email_id !== 'string'
  )
    return;
  const providerId = event.data.email_id;
  const at =
    'created_at' in event && typeof event.created_at === 'string'
      ? new Date(event.created_at)
      : new Date();
  if (
    !Number.isFinite(+at) ||
    !h['svix-id'] ||
    h['svix-id'].length > 200 ||
    !providerId ||
    providerId.length > 200
  )
    throw new AppError('Invalid email event', 400, 'invalid_email_event');
  await db().emailProviderEvent.upsert({
    where: { id: h['svix-id'] },
    update: {},
    create: { id: h['svix-id'], providerId, type: event.type, occurredAt: at },
  });
  const known = await db().serviceEmailDelivery.findUnique({ where: { providerId } });
  if (known)
    await db().$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ServiceEmailDelivery" WHERE id = ${known.id} FOR UPDATE`;
      await reconcile(tx, known.id);
    });
  // A bounce can arrive before Resend's acceptance response. Only suppress known attempted recipients.
  if (suppressionTypes.includes(event.type) && 'to' in event.data && Array.isArray(event.data.to)) {
    for (const email of event.data.to
      .filter((v): v is string => typeof v === 'string')
      .slice(0, 50)) {
      const attempted = await db().serviceEmailDelivery.findFirst({
        where: { email, firstAttemptAt: { not: null } },
        select: { id: true },
      });
      if (attempted)
        await db().serviceEmailSuppression.upsert({
          where: { email: normalized(email) },
          create: { email: normalized(email), reason: event.type.slice(6) },
          update: {},
        });
    }
  }
}
async function claim(id: string, texts: ServiceEmailTexts): Promise<ServiceEmailDelivery | null> {
  return db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ServiceEmailDelivery" WHERE id = ${id} FOR UPDATE`;
    const entry = await tx.serviceEmailDelivery.findUnique({ where: { id } });
    if (
      !entry ||
      !pending.includes(entry.status) ||
      +entry.nextAttemptAt > Date.now() ||
      (entry.leaseUntil && +entry.leaseUntil > Date.now())
    )
      return null;
    if (
      entry.attempts >= 6 ||
      (entry.firstAttemptAt && Date.now() - +entry.firstAttemptAt >= 23 * HOUR)
    ) {
      await tx.serviceEmailDelivery.update({
        where: { id },
        data: {
          status: 'held',
          payloadEncrypted: null,
          lastError: 'manual_reconciliation',
          leaseToken: null,
          leaseUntil: null,
        },
      });
      return null;
    }
    if (!(await eligible(tx, entry))) {
      await tx.serviceEmailDelivery.update({
        where: { id },
        data: { status: 'cancelled', payloadEncrypted: null, leaseToken: null, leaseUntil: null },
      });
      return null;
    }
    const config = serviceConfig();
    if (!config) return null;
    let payloadEncrypted = entry.payloadEncrypted;
    if (!payloadEncrypted) {
      if (
        (entry.purpose !== 'render_ready' && entry.purpose !== 'render_failed') ||
        !entry.renderId
      ) {
        await tx.serviceEmailDelivery.update({
          where: { id },
          data: { status: 'held', lastError: 'missing_payload' },
        });
        return null;
      }
      payloadEncrypted = seal(
        buildPayload(
          entry.email,
          `${config.appUrl}/r/${encodeURIComponent(entry.renderId)}`,
          texts[entry.locale === 'es' ? 'es' : 'en'][entry.purpose],
        ),
        config.secret,
        aad(entry),
      );
    }
    return tx.serviceEmailDelivery.update({
      where: { id },
      data: {
        status: 'sending',
        payloadEncrypted,
        leaseToken: randomUUID(),
        leaseUntil: new Date(Date.now() + 90000),
        firstAttemptAt: entry.firstAttemptAt ?? new Date(),
        attempts: { increment: 1 },
      },
    });
  });
}
async function dispatch(entry: ServiceEmailDelivery, fetcher: typeof fetch): Promise<void> {
  const config = serviceConfig();
  if (!config) return;
  // Recheck immediately before the external side effect. Already in-flight requests cannot be revoked.
  const latest = await db().serviceEmailDelivery.findUnique({ where: { id: entry.id } });
  if (!latest || latest.leaseToken !== entry.leaseToken || !pending.includes(latest.status)) return;
  if (!(await eligible(db(), latest))) {
    await db().serviceEmailDelivery.updateMany({
      where: { id: latest.id, leaseToken: entry.leaseToken },
      data: { status: 'cancelled', payloadEncrypted: null, leaseToken: null, leaseUntil: null },
    });
    return;
  }
  let payload: MailPayload;
  try {
    payload = unseal(entry.payloadEncrypted ?? '', config.secret, aad(entry));
  } catch {
    await db().serviceEmailDelivery.updateMany({
      where: { id: entry.id, leaseToken: entry.leaseToken },
      data: {
        status: 'held',
        lastError: 'payload_unavailable',
        leaseToken: null,
        leaseUntil: null,
      },
    });
    return;
  }
  const result = await sendResendMail(payload, `service/${entry.id}`, config, fetcher);
  await db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ServiceEmailDelivery" WHERE id = ${entry.id} FOR UPDATE`;
    const current = await tx.serviceEmailDelivery.findUnique({ where: { id: entry.id } });
    if (!current || current.leaseToken !== entry.leaseToken) return;
    await tx.serviceEmailDelivery.update({
      where: { id: entry.id },
      data: {
        status: result.status,
        providerId: result.providerId,
        acceptedAt: result.status === 'accepted' ? new Date() : undefined,
        nextAttemptAt: new Date(Date.now() + Math.min(60, 2 ** entry.attempts) * 60000),
        leaseToken: null,
        leaseUntil: null,
        payloadEncrypted: result.status === 'retry' ? undefined : null,
        lastError: result.status === 'accepted' ? null : 'provider_request',
      },
    });
    await reconcile(tx, entry.id);
  });
}
export async function runServiceEmails(
  texts: ServiceEmailTexts,
  fetcher: typeof fetch = fetch,
  options: { userId?: string; limit?: number } = {},
): Promise<{ examined: number }> {
  if (!serviceConfig()) return { examined: 0 };
  const start = Date.now();
  const limit = Math.max(1, Math.min(10, options.limit ?? 10));
  const where: Prisma.ServiceEmailDeliveryWhereInput = {
    ...(options.userId ? { userId: options.userId } : {}),
    status: { in: pending },
    nextAttemptAt: { lte: new Date() },
    OR: [{ leaseUntil: null }, { leaseUntil: { lte: new Date() } }],
  };
  const auth = await db().serviceEmailDelivery.findMany({
    where: { ...where, purpose: { in: ['verify_email', 'reset_password'] } },
    orderBy: { nextAttemptAt: 'asc' },
    take: limit,
  });
  const renders =
    auth.length < limit
      ? await db().serviceEmailDelivery.findMany({
          where: { ...where, purpose: { in: ['render_ready', 'render_failed'] } },
          orderBy: { nextAttemptAt: 'asc' },
          take: limit - auth.length,
        })
      : [];
  let examined = 0;
  for (const row of [...auth, ...renders]) {
    if (Date.now() - start > 25000) break;
    const entry = await claim(row.id, texts);
    examined++;
    if (entry) await dispatch(entry, fetcher);
  }
  return { examined };
}
