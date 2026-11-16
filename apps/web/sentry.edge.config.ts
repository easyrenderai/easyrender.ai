import * as Sentry from '@sentry/nextjs';
import { filterMailingTelemetry, redactMailingTokens } from './lib/mailing-privacy';

Sentry.init({
  beforeSend: filterMailingTelemetry,
  beforeSendTransaction: filterMailingTelemetry,
  beforeBreadcrumb: redactMailingTokens,
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
