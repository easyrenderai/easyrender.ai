import { afterEach, expect, it, vi } from 'vitest';
import { buildMailPayload, mailingConfig, recipientAllowed, sendMail } from './transport';

const env = () => {
  for (const [k, v] of Object.entries({
    VERCEL_ENV: 'production',
    EMAIL_ONBOARDING_ENABLED: 'true',
    EMAIL_TOKEN_SECRET: 'unit-test-secret-not-production-123456789',
    RESEND_API_KEY: 'unit-test-key',
    RESEND_WEBHOOK_SECRET: 'unit-test-webhook',
    EMAIL_FROM: 'Team <hello@example.com>',
    EMAIL_REPLY_TO: 'help@example.com',
    EMAIL_LEGAL_IDENTITY: 'Example company, postal address',
    APP_URL: 'https://example.com',
  }))
    vi.stubEnv(k, v);
};
const texts = {
  confirmSubject: 'Confirm',
  confirmBody: 'Requested',
  confirmAction: 'Confirm email',
  footerReason: 'You requested these emails',
  unsubscribeLabel: 'Unsubscribe',
  preferencesLabel: 'Preferences',
};
afterEach(() => vi.unstubAllEnvs());
it('requires explicit production enablement and all sender settings', () => {
  env();
  expect(mailingConfig()?.appUrl).toBe('https://example.com');
  vi.stubEnv('VERCEL_ENV', 'preview');
  expect(mailingConfig()).toBeNull();
});
it('supports an exact address allowlist for the launch smoke test', () => {
  env();
  vi.stubEnv('EMAIL_ALLOWED_RECIPIENTS', 'a@example.com');
  expect(recipientAllowed('a@example.com')).toBe(true);
  expect(recipientAllowed('ba@example.com')).toBe(false);
});
it('renders useful plain text, escaped HTML and RFC8058 headers without tracking pixels', () => {
  env();
  const mail = buildMailPayload(
    {
      subject: 'Hello',
      preheader: 'Read this',
      body: '<script>bad</script>\n\nReview one item',
      action: 'Review one item',
    },
    'a@example.com',
    {
      unsubscribe: 'https://example.com/email/unsubscribe?token=abc',
      preferences: 'https://example.com/account',
    },
    texts,
  );
  expect(mail.html).toContain('&lt;script&gt;');
  expect(mail.text).toContain('Review one item');
  expect(mail.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  expect(mail.headers['List-Unsubscribe']).toContain('/api/email/unsubscribe');
  expect(mail.html).not.toContain('<img');
});
it('uses the same idempotency key and immutable payload on transport retry', async () => {
  env();
  const mail = buildMailPayload(
    { subject: 'Hello', preheader: 'Read', body: 'Useful', action: 'Try' },
    'a@example.com',
    {
      unsubscribe: 'https://example.com/email/unsubscribe?token=abc',
      preferences: 'https://example.com/account',
    },
    texts,
  );
  const requests: RequestInit[] = [];
  const fake = vi.fn(async (_url: unknown, init?: RequestInit) => {
    if (!init) throw new Error('Missing request options');
    requests.push(init);
    return new Response(JSON.stringify({ id: 'provider-1' }), { status: 200 });
  }) as unknown as typeof fetch;
  expect(await sendMail(mail, 'same-id', fake)).toEqual({
    status: 'accepted',
    providerId: 'provider-1',
  });
  await sendMail(mail, 'same-id', fake);
  expect(requests[0].body).toEqual(requests[1].body);
  expect(new Headers(requests[0].headers).get('Idempotency-Key')).toBe('mailing/same-id');
});
it('provides a clickable confirmation link in HTML', () => {
  env();
  const url = 'https://example.com/email/confirm?token=abc';
  const mail = buildMailPayload(
    { subject: 'Confirm', preheader: 'Request', body: 'Confirm your choice', action: '' },
    'a@example.com',
    {
      confirm: url,
      unsubscribe: 'https://example.com/email/unsubscribe?token=x',
      preferences: 'https://example.com/account',
    },
    texts,
  );
  expect(mail.html).toContain(`href="${url}"`);
  expect(mail.html.split(url)).toHaveLength(2);
  expect(mail.html).toContain('name="viewport"');
  expect(mail.html).toContain('max-width:600px');
  expect(mail.text).toContain(url);
});
it('keeps the editorial action metadata out of the already complete email body', () => {
  env();
  const mail = buildMailPayload(
    {
      subject: 'Hello',
      preheader: 'Read',
      body: 'Choose one product and prepare its photo.',
      action: 'Internal action summary',
    },
    'a@example.com',
    {
      unsubscribe: 'https://example.com/email/unsubscribe?token=x',
      preferences: 'https://example.com/account',
    },
    texts,
  );
  expect(mail.text).not.toContain('Internal action summary');
});
it('retries a concurrent idempotent request but rejects a conflicting payload', async () => {
  env();
  const mail = buildMailPayload(
    { subject: 'Hello', preheader: 'Read', body: 'Useful', action: '' },
    'a@example.com',
    {
      unsubscribe: 'https://example.com/email/unsubscribe?token=x',
      preferences: 'https://example.com/account',
    },
    texts,
  );
  for (const [name, expected] of [
    ['concurrent_idempotent_requests', 'retry'],
    ['invalid_idempotent_request', 'failed'],
  ]) {
    const fake = vi.fn(async () =>
      Response.json({ name }, { status: 409 }),
    ) as unknown as typeof fetch;
    expect(await sendMail(mail, 'same-id', fake)).toEqual({ status: expected });
  }
});
