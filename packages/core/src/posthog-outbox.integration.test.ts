import { db } from '@easyrender/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventUuid } from './analytics-id';
import { enqueuePosthogEvent, flushPosthogEvents } from './posthog-outbox';

const url = process.env.TEST_DATABASE_URL;
if (url) {
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
    throw new Error('Local scratch DB only');
  process.env.DATABASE_URL = url;
}
describe.skipIf(!url)('durable PostHog delivery with actual Postgres claims', () => {
  const userId = `outbox-qa-${crypto.randomUUID()}`;
  const fetcher = vi.fn();
  const occurredAt = new Date();
  const event = (suffix = 'one') => ({
    id: eventUuid(`${userId}:${suffix}`),
    userId,
    event: 'render_ready',
    distinctId: userId,
    alias: null,
    occurredAt,
    properties: { source_channel: 'mcp' },
  });
  beforeAll(async () => {
    await db().user.create({
      data: { id: userId, name: 'Fixture', email: `${userId}@example.invalid` },
    });
  });
  beforeEach(async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_fake_local_fixture');
    vi.stubGlobal('fetch', fetcher);
    fetcher.mockReset().mockResolvedValue(new Response('{}'));
    await db().posthogDelivery.deleteMany({ where: { userId } });
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    await db().user.delete({ where: { id: userId } });
    await db().$disconnect();
  });
  it('replays preserve original identity, timestamp and payload', async () => {
    await enqueuePosthogEvent(event());
    await enqueuePosthogEvent({
      ...event(),
      occurredAt: new Date(+occurredAt + 86400000),
      properties: { source_channel: 'changed' },
    });
    const stored = await db().posthogDelivery.findUniqueOrThrow({ where: { id: event().id } });
    expect(stored).toMatchObject({ occurredAt, properties: { source_channel: 'mcp' } });
    expect(await db().posthogDelivery.count({ where: { userId } })).toBe(1);
  });
  it('keeps transport failure pending and concurrent recovery sends it once with original timestamp', async () => {
    await enqueuePosthogEvent(event());
    fetcher.mockRejectedValueOnce(new Error('fixture network failure'));
    await flushPosthogEvents({ eventIds: [event().id] });
    expect(await db().posthogDelivery.findUnique({ where: { id: event().id } })).toMatchObject({
      deliveredAt: null,
      lastError: 'transport',
      attempts: 1,
      leaseToken: null,
    });
    await db().posthogDelivery.update({
      where: { id: event().id },
      data: { nextAttemptAt: new Date(0) },
    });
    await Promise.all([
      flushPosthogEvents({ eventIds: [event().id] }),
      flushPosthogEvents({ eventIds: [event().id] }),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const body = JSON.parse(fetcher.mock.calls[1][1].body);
    expect(body.batch[0]).toMatchObject({
      uuid: event().id,
      timestamp: occurredAt.toISOString(),
      distinct_id: userId,
    });
    expect(await db().posthogDelivery.findUnique({ where: { id: event().id } })).toMatchObject({
      lastError: null,
      attempts: 2,
      deliveredAt: expect.any(Date),
    });
  });
  it('an expired worker cannot acknowledge a replacement lease', async () => {
    await enqueuePosthogEvent(event());
    fetcher.mockImplementationOnce(async () => {
      await db().posthogDelivery.update({
        where: { id: event().id },
        data: { leaseToken: 'replacement', leaseUntil: new Date(Date.now() + 60000) },
      });
      return new Response('{}');
    });
    await flushPosthogEvents({ eventIds: [event().id] });
    expect(await db().posthogDelivery.findUnique({ where: { id: event().id } })).toMatchObject({
      deliveredAt: null,
      leaseToken: 'replacement',
    });
  });
  it('bounds a drain at fifty rows, then another invocation drains the remainder', async () => {
    for (let i = 0; i < 51; i++) await enqueuePosthogEvent(event(String(i)));
    await db().posthogDelivery.updateMany({
      where: { userId },
      data: { nextAttemptAt: new Date(0) },
    });
    await flushPosthogEvents();
    expect(
      await db().posthogDelivery.count({ where: { userId, deliveredAt: { not: null } } }),
    ).toBe(50);
    await flushPosthogEvents();
    expect(await db().posthogDelivery.count({ where: { userId, deliveredAt: null } })).toBe(0);
  });
  it('expires old pending events without sending, removes old delivered/dead payloads', async () => {
    await enqueuePosthogEvent({ ...event(), occurredAt: new Date(Date.now() - 8 * 86400000) });
    await flushPosthogEvents({ eventIds: [event().id] });
    expect(fetcher).not.toHaveBeenCalled();
    expect(await db().posthogDelivery.findUnique({ where: { id: event().id } })).toMatchObject({
      deadAt: expect.any(Date),
      lastError: 'expired',
    });
    await db().posthogDelivery.update({
      where: { id: event().id },
      data: { deadAt: new Date(Date.now() - 31 * 86400000) },
    });
    await flushPosthogEvents({ eventIds: [event().id] });
    expect(await db().posthogDelivery.findUnique({ where: { id: event().id } })).toBeNull();
  });
});
