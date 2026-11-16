import { captureException } from '@sentry/core';

// Reports an unexpected failure to Sentry (a no-op until the app has initialised it with a DSN)
// and keeps the server log line. Expected 4xx errors are not reported. A handled outcome that
// still deserves a trace (a render that timed out and was refunded) goes in as a warning.
export function reportError(
  error: unknown,
  context: Record<string, string> = {},
  level: 'error' | 'warning' = 'error',
) {
  console.error(error);
  captureException(error, { extra: context, level });
}
