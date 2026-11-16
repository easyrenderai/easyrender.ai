import { describe, expect, it } from 'vitest';
import {
  filterMailingTelemetry,
  isMailingTokenLocation,
  redactMailingTokens,
} from './mailing-privacy';

describe('mail token privacy', () => {
  it('recognizes only token action routes', () => {
    expect(isMailingTokenLocation('https://easyrender.ai/email/confirm?token=private')).toBe(true);
    expect(isMailingTokenLocation('/api/email/unsubscribe?token=private')).toBe(true);
    expect(isMailingTokenLocation('/email/unsubscribe-other')).toBe(false);
    expect(isMailingTokenLocation('/account')).toBe(false);
    expect(isMailingTokenLocation('GET /email/confirm')).toBe(true);
  });
  it('drops token-page telemetry and scrubs previous URLs from unrelated events', () => {
    expect(filterMailingTelemetry({ request: { url: '/email/confirm?token=private' } })).toBeNull();
    const event = {
      request: {
        url: '/account',
        headers: { Referer: 'https://easyrender.ai/email/confirm?token=private&locale=es' },
      },
      breadcrumbs: [
        {
          data: {
            token: 'private',
            body: '{"token":"private"}',
            query_string: 'token=private&locale=es',
          },
        },
      ],
    };
    expect(
      redactMailingTokens({
        query: [
          ['token', 'private'],
          ['locale', 'es'],
        ],
      }),
    ).toEqual({
      query: [
        ['token', '[Filtered]'],
        ['locale', 'es'],
      ],
    });
    const clean = redactMailingTokens(event);
    expect(JSON.stringify(clean)).not.toContain('private');
    expect(clean.request.url).toBe('/account');
    expect(event.breadcrumbs[0].data.token).toBe('private');
  });
});
