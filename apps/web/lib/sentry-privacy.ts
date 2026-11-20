import {
  filterMailingTelemetry,
  isMailingTokenLocation,
  redactMailingTokens,
  type TelemetryEvent,
} from './mailing-privacy';

// Options every Sentry runtime (server, edge) shares so a private link never leaves the app.
//
// `traceLifecycle: 'static'` is load-bearing. The SDK defaults to span streaming, where
// `beforeSendTransaction` is never called: a traced request to an invite, verify-email,
// reset-password, confirm or unsubscribe link then reached Sentry with its token in the span
// attributes. Static sends one transaction event per request again, which runs through the
// filter below (dropped on a token route, token redacted everywhere else).
export const mailingPrivacyOptions = {
  traceLifecycle: 'static',
  beforeSend: filterMailingTelemetry,
  beforeSendTransaction: filterMailingTelemetry,
  beforeBreadcrumb: redactMailingTokens,
} as const;

/**
 * The browser's options. The page the visitor is on decides, because a browser event describes
 * the page's own URL: on a token page nothing is sent at all.
 */
export function browserPrivacyOptions(getHref: () => string) {
  const isTokenPage = () => isMailingTokenLocation(getHref());
  return {
    enabled: !isTokenPage(),
    traceLifecycle: 'static',
    beforeSend: <T extends TelemetryEvent>(event: T) =>
      isTokenPage() ? null : filterMailingTelemetry(event),
    beforeSendTransaction: <T extends TelemetryEvent>(event: T) =>
      isTokenPage() ? null : filterMailingTelemetry(event),
    beforeBreadcrumb: <T>(crumb: T) => (isTokenPage() ? null : redactMailingTokens(crumb)),
  } as const;
}
