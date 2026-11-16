import { expect, it } from 'vitest';
import { escapeMailHtml, makeMailToken, readMailToken } from './security';

const secret = 'testing-secret-not-a-real-credential-123456789';
it('binds tokens to purpose and nonce, rejecting tampering', () => {
  const token = makeMailToken('subscriber', 'nonce', 'confirm', secret);
  expect(readMailToken(token, 'confirm', secret)).toEqual({ id: 'subscriber', nonce: 'nonce' });
  expect(readMailToken(token, 'unsubscribe', secret)).toBeNull();
  expect(readMailToken(`${token}x`, 'confirm', secret)).toBeNull();
  expect(readMailToken(token, 'confirm', `${secret}x`)).toBeNull();
  expect(readMailToken('a'.repeat(3000), 'confirm', secret)).toBeNull();
});
it('escapes dynamic content in HTML email', () =>
  expect(escapeMailHtml('<img src=x onerror="bad">&')).toBe(
    '&lt;img src=x onerror=&quot;bad&quot;&gt;&amp;',
  ));
