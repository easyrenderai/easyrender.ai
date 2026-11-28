import {
  filterMailingTelemetry,
  isMailingTokenLocation,
  redactMailingTokens,
  type TelemetryEvent,
} from './mailing-privacy';

function isFeedbackLocation(value: unknown): boolean {
  return typeof value === 'string' && /\/api\/renders\/[^/?\s]+\/feedback(?:[?\s]|$)/.test(value);
}

// Feedback may contain contact details despite the form's hint. Exclude the whole request,
// including error payloads and spans, so the SDK never exports its body.
function filterPrivateTelemetry<T extends TelemetryEvent>(event: T): T | null {
  const locations = [
    event.request?.url,
    event.transaction,
    ...Object.values(event.contexts?.trace?.data ?? {}),
  ];
  if (locations.some(isFeedbackLocation)) return null;
  return filterMailingTelemetry(event);
}

function filterPrivateBreadcrumb<T>(crumb: T): T | null {
  const data = (crumb as { data?: Record<string, unknown> }).data;
  if (Object.values(data ?? {}).some(isFeedbackLocation)) return null;
  return redactMailingTokens(crumb);
}

// Options every Sentry runtime (server, edge) shares so a private link never leaves the app.
//
// `traceLifecycle: 'static'` is load-bearing. The SDK defaults to span streaming, where
// `beforeSendTransaction` is never called: a traced request to an invite, verify-email,
// reset-password, confirm or unsubscribe link then reached Sentry with its token in the span
// attributes. Static sends one transaction event per request again, which runs through the
// filter below (dropped on a token route, token redacted everywhere else).
export const mailingPrivacyOptions = {
  traceLifecycle: 'static',
  beforeSend: filterPrivateTelemetry,
  beforeSendTransaction: filterPrivateTelemetry,
  beforeBreadcrumb: filterPrivateBreadcrumb,
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
      isTokenPage() ? null : filterPrivateTelemetry(event),
    beforeSendTransaction: <T extends TelemetryEvent>(event: T) =>
      isTokenPage() ? null : filterPrivateTelemetry(event),
    beforeBreadcrumb: <T>(crumb: T) => (isTokenPage() ? null : filterPrivateBreadcrumb(crumb)),
  } as const;
}
