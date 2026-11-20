export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

export const notFound = () => new AppError('Render not found', 404, 'not_found');

// Statuses a caller can wait out: a limit (429) or a provider or gateway failure (502, 503, 504).
// A 500 is not here: nothing says whether it ran, so a paid call is never replayed on it.
const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([429, 502, 503, 504]);

// 503s that a missing setting causes. Waiting does not fix them, so an agent would only loop.
const CONFIG_CODES: ReadonlySet<string> = new Set(['no_stripe', 'not_configured']);

/**
 * The one answer to "may the caller try again?" for REST (`retryable`) and MCP (`error.retryable`).
 * It decides by status, minus the config codes above, so both surfaces agree for every code.
 * It never authorizes a second paid submission: read the resource first (docs/api.md).
 */
export function isRetryable(error: unknown): boolean {
  return (
    error instanceof AppError &&
    RETRYABLE_STATUSES.has(error.status) &&
    !CONFIG_CODES.has(error.code)
  );
}
