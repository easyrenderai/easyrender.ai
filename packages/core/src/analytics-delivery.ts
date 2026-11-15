import { analyticsDeliveryHealth } from './analytics-delivery-health';
import { reconcileBusinessAnalytics } from './analytics-recovery';
import { cleanGoogleMeasurementIdentities, flushGooglePurchases } from './google-outbox';
import { flushPosthogEvents } from './posthog-outbox';
import { reportError } from './report';

/** Independent recovery: either analytics destination failing must not stop render maintenance. */
export async function flushAnalyticsDeliveries() {
  let recovery: { examined: number } | { error: string };
  try {
    recovery = await reconcileBusinessAnalytics();
  } catch {
    recovery = { error: 'unavailable' };
    reportError(new Error('Business analytics reconciliation failed'), { component: 'analytics' });
  }
  const results = await Promise.allSettled([
    flushGooglePurchases(),
    flushPosthogEvents(),
    cleanGoogleMeasurementIdentities(),
  ]);
  const names = ['google', 'posthog', 'privacy'] as const;
  const summary = Object.fromEntries(
    results.map((result, i) => {
      if (result.status === 'fulfilled') return [names[i], result.value ?? { disabled: true }];
      reportError(new Error('Analytics delivery maintenance failed'), { component: names[i] });
      return [names[i], { error: 'unavailable' }];
    }),
  );
  try {
    return { ...summary, recovery, health: await analyticsDeliveryHealth() };
  } catch {
    return { ...summary, recovery, health: { error: 'unavailable' } };
  }
}
