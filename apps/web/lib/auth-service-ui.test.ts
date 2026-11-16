import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { EmailVerification } from '@/components/email-verification';
import { ServiceAuthForm } from '@/components/service-auth-form';
import en from '@/messages/en.json';

vi.mock('@/lib/auth-client', () => ({ authClient: {} }));
it('shows recovery unavailable truthfully without accepting an email when sending is disabled', () => {
  const html = renderToStaticMarkup(
    createElement(ServiceAuthForm, {
      mode: 'forgot',
      isAvailable: false,
      copy: en.AuthService,
      locale: 'en',
      token: '',
    }),
  );
  expect(html).toContain(en.AuthService.unavailable);
  expect(html).not.toContain('type="email"');
});
it('keeps token pages read-only until explicit action and hides invalid reset form', () => {
  const html = renderToStaticMarkup(
    createElement(ServiceAuthForm, {
      mode: 'verify',
      isAvailable: true,
      copy: en.AuthService,
      locale: 'es',
      token: 'private-token',
    }),
  );
  expect(html).toContain('lang="es"');
  expect(html).toContain(en.AuthService.verifyAction);
  expect(html).not.toContain('private-token');
  const reset = renderToStaticMarkup(
    createElement(ServiceAuthForm, {
      mode: 'reset',
      isAvailable: true,
      copy: en.AuthService,
      locale: 'en',
      token: '',
    }),
  );
  expect(reset).toContain(en.AuthService.invalidLink);
  expect(reset).not.toContain('type="password"');
});
it('shows verification status and never offers resend for already verified users', () => {
  const html = renderToStaticMarkup(
    createElement(EmailVerification, {
      email: 'test@example.invalid',
      isVerified: true,
      isAvailable: true,
      copy: en.AuthService,
      locale: 'en',
    }),
  );
  expect(html).toContain(en.AuthService.verified);
  expect(html).not.toContain(en.AuthService.resend);
});
