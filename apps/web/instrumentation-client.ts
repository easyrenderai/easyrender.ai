import * as Sentry from '@sentry/nextjs';
import {
  BLOB_URL_SPANS,
  BROWSER_EXTENSION_ERRORS,
  BROWSER_EXTENSION_URLS,
  WEBGL_UNAVAILABLE_ERRORS,
} from './lib/sentry-noise';
import { browserPrivacyOptions } from './lib/sentry-privacy';

// No session replay: shoppers upload product photos and we do not record the screen.
Sentry.init({
  ...browserPrivacyOptions(() => window.location.href),
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  ignoreErrors: [...BROWSER_EXTENSION_ERRORS, ...WEBGL_UNAVAILABLE_ERRORS],
  ignoreSpans: BLOB_URL_SPANS,
  denyUrls: BROWSER_EXTENSION_URLS,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
