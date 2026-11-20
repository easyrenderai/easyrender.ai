import * as Sentry from '@sentry/nextjs';
import { mailingPrivacyOptions } from './lib/sentry-privacy';

Sentry.init({
  ...mailingPrivacyOptions,
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
