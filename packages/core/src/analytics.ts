import { db, type Render } from '@easyrender/db';
import { eventUuid } from './analytics-id';
import { enqueuePosthogEvent, flushPosthogEvents } from './posthog-outbox';
import { reportError } from './report';

export { eventUuid } from './analytics-id';

import type { FunnelEvent } from './analytics-events';
import { type Attribution, pickAttribution, UTM_KEYS } from './attribution';

export type { FunnelEvent } from './analytics-events';

type Properties = Record<string, string | number | boolean | null>;
type EventContext = {
  userId: string | null;
  previewId: string | null;
  source: string;
  attribution: Attribution;
  hasDeferredDelivery?: boolean;
  distinctId?: string;
};
type Scheduler = (work: () => Promise<void>) => void;
let schedule: Scheduler = (work) => {
  void work();
};
export function setAnalyticsScheduler(scheduler: Scheduler) {
  schedule = scheduler;
}
export function deferAnalytics(work: () => Promise<void>) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    schedule(async () => {
      try {
        await work();
      } catch {
        /* Best-effort analytics only. */
      }
    });
  } catch {
    /* No platform request context. */
  }
}
export function eventProperties(eventId: string, context: EventContext): Properties {
  const a = context.attribution;
  return {
    event_id: eventId,
    user_id: context.userId,
    preview_id: context.previewId,
    source_channel: ['web', 'api', 'mcp'].includes(context.source) ? context.source : 'web',
    ...Object.fromEntries(UTM_KEYS.map((key) => [`ft_${key}`, a[key]])),
    ft_referrer: a.referrer,
    ft_landing_path: a.landing_path,
    geo_country: a.geo_country,
    consent_region: a.consent_region_at_create ?? 'strict',
  };
}
/** Persist before returning; only external delivery runs after the business response. */
export async function captureServer(
  event: FunnelEvent | 'purchase_completed',
  identity: string,
  context: EventContext,
  properties: Properties,
  alias?: string,
  occurredAt = new Date(),
) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    const user = context.userId
      ? await db().user.findUnique({ where: { id: context.userId } })
      : null;
    const attribution = user?.first_seen_at ? pickAttribution(user) : context.attribution;
    const uuid = eventUuid(`${event}:${identity}`);
    await enqueuePosthogEvent({
      id: uuid,
      subjectId: identity,
      userId: context.userId,
      event,
      distinctId: context.distinctId ?? context.userId ?? `pv_${context.previewId}`,
      alias: alias ?? null,
      occurredAt,
      properties: { ...eventProperties(uuid, { ...context, attribution }), ...properties },
    });
    if (!context.hasDeferredDelivery)
      deferAnalytics(async () => {
        await flushPosthogEvents({ eventIds: [uuid] });
      });
  } catch {
    // Do not attach the original error: transport/DB errors can include payloads or credentials.
    reportError(new Error('Unable to persist business analytics event'), {
      component: 'analytics',
    });
  }
}
export function captureRender(
  event: Exclude<FunnelEvent, 'signup' | 'purchase'>,
  render: Render,
  properties: Properties,
  options: { occurredAt?: Date; hasDeferredDelivery?: boolean } = {},
) {
  return captureServer(
    event,
    render.id,
    {
      userId: render.userId,
      previewId: render.id,
      source: render.source,
      attribution: pickAttribution(render),
      hasDeferredDelivery: options.hasDeferredDelivery,
    },
    {
      ...(render.notificationLocale ? { ui_locale: render.notificationLocale } : {}),
      ...properties,
    },
    undefined,
    options.occurredAt,
  );
}
