import * as Sentry from '@sentry/nextjs';
import {
  filterMailingTelemetry,
  isMailingTokenLocation,
  redactMailingTokens,
} from './lib/mailing-privacy';

// No session replay: shoppers upload product photos and we do not record the screen.
Sentry.init({
  enabled: !isMailingTokenLocation(window.location.href),
  beforeSend: (event) =>
    isMailingTokenLocation(window.location.href) ? null : filterMailingTelemetry(event),
  beforeSendTransaction: (event) =>
    isMailingTokenLocation(window.location.href) ? null : filterMailingTelemetry(event),
  beforeBreadcrumb: (crumb) =>
    isMailingTokenLocation(window.location.href) ? null : redactMailingTokens(crumb),
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
