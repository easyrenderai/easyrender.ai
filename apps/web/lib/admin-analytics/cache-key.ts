import { createHmac } from 'node:crypto';

/** Cache invalidation fingerprint, never a password verifier or a stored credential. */
export function analyticsConfigKey(values: Array<string | undefined>): string {
  return createHmac('sha256', JSON.stringify(values))
    .update('admin-analytics-config-v1')
    .digest('hex');
}
