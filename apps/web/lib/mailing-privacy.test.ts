import { describe, expect, it } from 'vitest';
import {
  filterMailingTelemetry,
  isMailingTokenLocation,
  MAILING_TOKEN_CHECK_SCRIPT,
  redactMailingTokens,
} from './mailing-privacy';

describe('mail token privacy', () => {
  it('also protects account verification and recovery tokens', () => {
    for (const path of [
      '/verify-email',
      '/reset-password',
      '/api/auth/verify-email',
      '/api/auth/reset-password',
      '/api/email/verify-account',
    ]) {
      expect(isMailingTokenLocation(`${path}?token=private`)).toBe(true);
      expect(filterMailingTelemetry({ request: { url: `${path}?token=private` } })).toBeNull();
    }
    expect(isMailingTokenLocation('/reset-password-guide')).toBe(false);
  });
  it('recognizes only token action routes', () => {
    expect(isMailingTokenLocation('https://easyrender.ai/email/confirm?token=private')).toBe(true);
    expect(isMailingTokenLocation('/api/email/unsubscribe?token=private')).toBe(true);
    expect(isMailingTokenLocation('/email/unsubscribe-other')).toBe(false);
    expect(isMailingTokenLocation('/account')).toBe(false);
    expect(isMailingTokenLocation('GET /email/confirm')).toBe(true);
  });
  it('omits the outreach code from telemetry on invitations and auth returns', () => {
    const code = '61e709c0-00d9-4a88-8773-c2f33e2744f3';
    const invite = `/invite/${code}`;
    const signup = `/es/sign-up?next=${encodeURIComponent(invite)}`;
    expect(isMailingTokenLocation(invite)).toBe(true);
    expect(filterMailingTelemetry({ request: { url: signup } })).toBeNull();
    expect(
      JSON.stringify(
        redactMailingTokens({
          rollback: signup,
          referer: invite,
        }),
      ),
    ).not.toContain(code);
    expect(isMailingTokenLocation('/sign-up?next=%2Fdashboard')).toBe(false);
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

it('the script the browser runs before the Google tag agrees with the server on every address', () => {
  const check = new Function(
    `${MAILING_TOKEN_CHECK_SCRIPT}; return erIsMailingTokenLocation;`,
  )() as (href: string) => boolean;
  for (const href of [
    'https://easyrender.ai/',
    'https://easyrender.ai/pricing',
    'https://easyrender.ai/invite/abc',
    'https://easyrender.ai/invite/abc/extra',
    'https://easyrender.ai/sign-in?next=%2Finvite%2Fabc',
    'https://easyrender.ai/sign-in?next=%2Fdashboard',
    'https://easyrender.ai/email/confirm?token=x',
    'https://easyrender.ai/email/unsubscribe/abc',
    'https://easyrender.ai/api/email/verify-account',
    'https://easyrender.ai/verify-email',
    'https://easyrender.ai/reset-password?token=x',
    'https://easyrender.ai/api/auth/reset-password',
    'https://easyrender.ai/emails',
  ])
    expect(check(href), href).toBe(isMailingTokenLocation(href));
  expect(check('https://easyrender.ai/invite/abc')).toBe(true);
  expect(check('https://easyrender.ai/pricing')).toBe(false);
});
