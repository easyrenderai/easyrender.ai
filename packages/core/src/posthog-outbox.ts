import { randomUUID } from 'node:crypto';
import { db, type PosthogDelivery, type Prisma } from '@easyrender/db';
import { eventUuid } from './analytics-id';
import { sanitizeProperties } from './attribution';

const DAY = 86_400_000;
const MAX_AGE = 7 * DAY;
const MAX_ATTEMPTS = 20;
const RETENTION = 30 * DAY;
type Event = Pick<
  PosthogDelivery,
  'id' | 'userId' | 'event' | 'distinctId' | 'alias' | 'occurredAt'
> & {
  subjectId?: string;
  properties: Record<string, string | number | boolean | null>;
};
export async function enqueuePosthogEvent(event: Event) {
  const properties = sanitizeProperties(
    event.properties,
    (event.event === 'purchase' || event.event === 'purchase_completed') &&
      event.properties.has_ad_click_attribution === true,
  ) as Prisma.InputJsonObject;
  if (Buffer.byteLength(JSON.stringify(properties)) > 16384 || !Number.isFinite(+event.occurredAt))
    throw new Error('Invalid analytics event');
  // Replay never rewrites the original timestamp, attribution or payload.
  await db().posthogDelivery.upsert({
    where: { id: event.id },
    update: { id: event.id, subjectId: event.subjectId ?? event.id },
    create: { ...event, subjectId: event.subjectId ?? event.id, properties },
  });
}

/** A 2xx means transport acceptance, not a promise of downstream report attribution. */
export async function sendPosthogEvent(entry: PosthogDelivery, fetcher: typeof fetch = fetch) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return 'disabled';
  const host =
    process.env.POSTHOG_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com';
  const payload = {
    event: entry.event,
    uuid: entry.id,
    distinct_id: entry.distinctId,
    timestamp: entry.occurredAt.toISOString(),
    properties: { ...(entry.properties as Record<string, unknown>), $geoip_disable: true },
  };
  const batch = entry.alias
    ? [
        {
          event: '$create_alias',
          uuid: eventUuid(`alias:${entry.id}`),
          distinct_id: entry.distinctId,
          timestamp: payload.timestamp,
          properties: { distinct_id: entry.distinctId, alias: entry.alias, $geoip_disable: true },
        },
        payload,
      ]
    : [payload];
  try {
    const url = new URL('/batch/', host);
    if (url.username || url.password || !['http:', 'https:'].includes(url.protocol)) return 'retry';
    const response = await fetcher(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: key, batch }),
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
    });
    return response.ok ? 'delivered' : 'retry';
  } catch {
    return 'retry';
  }
}

/** `userId` limits a drain to one user's rows; production crons omit it and drain everything. */
export async function flushPosthogEvents(options: { eventIds?: string[]; userId?: string } = {}) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return { disabled: true, examined: 0 };
  const deadline = Date.now() + 25000;
  let examined = 0;
  // Maximum 50 rows / 25 seconds, each batch at most ten 5-second requests.
  for (let batch = 0; batch < 5 && Date.now() < deadline; batch++) {
    const now = new Date();
    const eligible = {
      deliveredAt: null,
      deadAt: null,
      nextAttemptAt: { lte: now },
      OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
      ...(options.eventIds ? { id: { in: options.eventIds.slice(0, 10) } } : {}),
      ...(options.userId ? { userId: options.userId } : {}),
    };
    const pending = await db().posthogDelivery.findMany({
      where: eligible,
      orderBy: { nextAttemptAt: 'asc' },
      take: 10,
    });
    if (!pending.length) break;
    await Promise.all(
      pending.map(async (entry) => {
        const leaseToken = randomUUID();
        const claim = await db().posthogDelivery.updateMany({
          where: { ...eligible, id: entry.id },
          data: { leaseToken, leaseUntil: new Date(+now + 60000), attempts: { increment: 1 } },
        });
        if (!claim.count) return;
        examined++;
        const isExpired = +now - +entry.occurredAt > MAX_AGE || entry.attempts >= MAX_ATTEMPTS;
        const result = isExpired ? 'expired' : await sendPosthogEvent(entry);
        await db().posthogDelivery.updateMany({
          where: { id: entry.id, leaseToken },
          data: {
            leaseToken: null,
            leaseUntil: null,
            deliveredAt: result === 'delivered' ? new Date() : null,
            deadAt: isExpired ? now : null,
            lastError: result === 'delivered' ? null : isExpired ? 'expired' : 'transport',
            nextAttemptAt: new Date(
              Date.now() + Math.min(3600, 60 * 2 ** Math.min(entry.attempts, 6)) * 1000,
            ),
          },
        });
      }),
    );
    if (options.eventIds) break;
  }
  const old = await db().posthogDelivery.findMany({
    where: {
      OR: [
        { deliveredAt: { lt: new Date(Date.now() - RETENTION) } },
        { deadAt: { lt: new Date(Date.now() - RETENTION) } },
      ],
    },
    select: { id: true },
    take: 100,
  });
  if (old.length)
    await db().posthogDelivery.deleteMany({ where: { id: { in: old.map((row) => row.id) } } });
  return { examined };
}
