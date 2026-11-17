import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildServiceMailPayload } from './service-template';
import { renderBrandedEmail } from './template';

const config = {
  appUrl: 'https://example.com',
  apiKey: 'test',
  from: 'Jorge <info@example.com>',
  replyTo: 'info@example.com',
  identity: 'Example company, postal address',
};
const action = {
  url: 'https://example.com/verify-email?token=fixture&locale=es',
  label: 'Verificar mi email',
};

describe('branded email rendering', () => {
  it('shows a static brand mark, readable wordmark, localized title and primary action', () => {
    const html = renderBrandedEmail({
      appUrl: config.appUrl,
      lang: 'es',
      title: 'Confirma tu email',
      preheader: 'Un paso más',
      body: 'Tu cuenta está casi lista.',
      action,
      identity: config.identity,
    });
    expect(html).toContain('<html lang="es">');
    expect(html).toContain('src="https://example.com/email/brand-mark.png"');
    expect(html).toContain('width="32" height="32"');
    expect(html).toContain('>easyrender</');
    expect(html).toContain('<h1');
    expect(html).toContain('Confirma tu email');
    expect(html).toContain('href="https://example.com/verify-email?token=fixture&amp;locale=es"');
    expect(html).toContain('role="presentation"');
    expect(html).toContain('max-width:600px');
    expect(html.match(/<img\b/g)).toHaveLength(1);
  });
  it('escapes content and rejects external or executable action/footer destinations', () => {
    const base = {
      appUrl: config.appUrl,
      title: '<script>title</script>',
      body: '<img onerror="bad">',
      identity: 'A&B',
      preheader: '<unsafe>',
    };
    const html = renderBrandedEmail({ ...base, action: { ...action, label: 'Go <now>' } });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;img onerror=&quot;bad&quot;&gt;');
    expect(html).toContain('A&amp;B');
    expect(html).toContain('Go &lt;now&gt;');
    for (const url of [
      'javascript:alert(1)',
      'https://evil.example',
      'https://user:pass@example.com',
    ]) {
      expect(() => renderBrandedEmail({ ...base, action: { url, label: 'Go' } })).toThrow();
      expect(() =>
        renderBrandedEmail({ ...base, footerLinks: [{ url, label: 'Preferences' }] }),
      ).toThrow();
    }
  });
  it('does not insert a marketing subscription or unsubscribe link into account emails', () => {
    const mail = buildServiceMailPayload(
      'reader@example.com',
      action.url,
      {
        subject: 'Verify your email · easyrender',
        title: 'One step to your account',
        preheader: 'Confirm your email',
        body: 'Please verify your address.',
        action: action.label,
        notice: 'This link expires in one hour.',
        footerReason: 'An update about your account.',
        lang: 'en',
      },
      config,
    );
    expect(mail.html).toContain('/email/brand-mark.png');
    expect(mail.html.indexOf('Verificar mi email')).toBeLessThan(
      mail.html.indexOf('This link expires'),
    );
    expect(mail.text).toContain(action.url);
    expect(mail.text).toContain('This link expires in one hour.');
    expect(mail.text).toContain('An update about your account.');
    expect(mail.headers).toEqual({});
    expect(mail.html).not.toContain('/unsubscribe');
    expect(mail.from).toBe(config.from);
    expect(mail.reply_to).toBe(config.replyTo);
  });
  it.each(['en', 'es'])('renders all real %s service copies with readable fallbacks', (lang) => {
    const { ServiceEmails } = JSON.parse(
      readFileSync(new URL(`../../../../apps/web/messages/${lang}.json`, import.meta.url), 'utf8'),
    );
    for (const copy of Object.values(ServiceEmails) as Parameters<
      typeof buildServiceMailPayload
    >[2][]) {
      const mail = buildServiceMailPayload('reader@example.com', action.url, copy, config);
      expect(copy.title).toBeTruthy();
      expect(copy.preheader).toBeTruthy();
      expect(mail.html).toContain(`<html lang="${lang}">`);
      expect(mail.text).toContain(copy.body);
      expect(mail.text).toContain(copy.action);
      expect(mail.subject).not.toContain('Easy Render');
      expect(mail.html).not.toMatch(/undefined|\[object Object\]/);
    }
  });
});
