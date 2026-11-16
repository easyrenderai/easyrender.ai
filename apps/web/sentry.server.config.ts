import * as Sentry from '@sentry/nextjs';
import { filterMailingTelemetry, redactMailingTokens } from './lib/mailing-privacy';

// Without NEXT_PUBLIC_SENTRY_DSN the SDK stays off, so local dev and previews send nothing.
Sentry.init({
  beforeSend: filterMailingTelemetry,
  beforeSendTransaction: filterMailingTelemetry,
  beforeBreadcrumb: redactMailingTokens,
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
