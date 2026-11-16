import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MailingPreferencesForm } from '@/components/mailing-preferences-form';
import { MailingTokenForm } from '@/components/mailing-token-form';
import en from '@/messages/en.json';

function preferences(status: string, isAvailable = true, expiresAt = '2099-01-01T00:00:00Z') {
  return renderToStaticMarkup(
    createElement(MailingPreferencesForm, {
      initial: { status, isAvailable, expiresAt, locale: status === 'pending' ? 'es' : null },
      copy: en.MailingUI,
      uiLocale: 'en',
    }),
  );
}
describe('mailing consent UI', () => {
  it('requires an explicit language and separate unchecked consent before requesting mail', () => {
    const html = preferences('none');
    expect(html).toContain('aria-checked="false"');
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(2);
    expect(html).not.toContain('aria-pressed="true"');
    expect(html).toContain('type="submit" disabled=""');
    expect(html).toContain(en.MailingUI.scope);
  });
  it('offers a pending subscriber an explicit resend without requiring unsubscribe first', () => {
    const html = preferences('pending');
    expect(html).toContain('Resend confirmation email');
    expect(html).toContain('Español');
    expect(html).toContain(en.MailingUI.stop);
  });
  it('does not offer consent after the registration window or while unavailable', () => {
    expect(preferences('none', true, '2020-01-01T00:00:00Z')).not.toContain('role="switch"');
    expect(preferences('none', false)).not.toContain('role="switch"');
    expect(preferences('active', false)).toContain(en.MailingUI.stop);
  });
  it('renders confirmation as a voluntary action and does not put tokens in links or visible copy', () => {
    const html = renderToStaticMarkup(
      createElement(MailingTokenForm, {
        intent: 'confirm',
        token: 'private-token',
        copy: en.MailingUI,
        uiLocale: 'es',
      }),
    );
    expect(html).toContain('lang="es"');
    expect(html).toContain(en.MailingUI.confirmButton);
    expect(html).not.toContain('private-token');
    expect(html).not.toContain(en.MailingUI.confirmed);
  });
});
