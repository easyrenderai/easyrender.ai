import * as Sentry from '@sentry/nextjs';
import { EXPECTED_SERVER_ERRORS } from './lib/sentry-noise';
import { mailingPrivacyOptions } from './lib/sentry-privacy';

// Without NEXT_PUBLIC_SENTRY_DSN the SDK stays off, so local dev and previews send nothing.
Sentry.init({
  ...mailingPrivacyOptions,
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  ignoreErrors: EXPECTED_SERVER_ERRORS,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
