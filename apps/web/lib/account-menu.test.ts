import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AccountCreditsLink, AccountMenu, type AccountMenuCopy } from '@/components/account-menu';

const copy = (balance: { label: string; number: string } | null): AccountMenuCopy => ({
  balanceLabel: balance?.label ?? null,
  balanceNumber: balance?.number ?? null,
  accountLabel: 'My account',
  creditsLinkLabel: 'Credits',
  buyCreditsLabel: 'Buy credits',
  menuLabel: 'Account menu',
});

const markup = (
  placement: 'app' | 'marketing',
  balance: { label: string; number: string } | null,
) => renderToStaticMarkup(createElement(AccountMenu, { placement, copy: copy(balance) }));

describe('account menu', () => {
  it('shows the full balance on the button and as the credits link', () => {
    const html = markup('app', { label: '120 credits', number: '120' });
    expect(html).toContain('aria-label="My account, 120 credits"');
    expect(html).toContain('>120 credits</span>');
    expect(html).toContain('>120</span>');
    expect(html).toContain('href="/credits"');
    expect(html).toContain('href="/credits#payg"');
    expect(html).toContain('aria-label="Buy credits"');
    expect(html).not.toContain('href="/account"');
    expect(html).toContain('aria-label="120 credits"');
    expect(html).toContain('hidden sm:inline');
    expect(html).toMatch(/data-placement="app"[^>]*class="relative"/);
    expect(html).not.toMatch(/data-placement="app"[^>]*max-sm:hidden/);
  });

  it('keeps the marketing pill out of the phone row and spells it out from md', () => {
    const html = markup('marketing', { label: '1 credit', number: '1' });
    expect(html).toContain('data-placement="marketing"');
    expect(html).toContain('max-sm:hidden');
    expect(html).toContain('md:hidden');
    expect(html).toContain('hidden md:inline');
    expect(html).toContain('aria-label="My account, 1 credit"');
    expect(html).toContain('href="/account"');
    expect(html).not.toContain('href="/credits#payg"');
  });

  it('hides the pill when the balance is missing and still links to credits', () => {
    const html = markup('app', null);
    expect(html).toContain('aria-label="My account"');
    expect(html).not.toContain('aria-label="My account,');
    expect(html).not.toContain('120');
    expect(html).toContain('aria-label="Credits"');
    expect(html).toContain('href="/credits"');
    expect(html).not.toContain('role="alert"');
  });

  it('shows a zero balance instead of treating it as missing', () => {
    const html = markup('app', { label: '0 credits', number: '0' });
    expect(html).toContain('aria-label="My account, 0 credits"');
    expect(html).toContain('>0</span>');
  });
});

describe('phone credits link', () => {
  it('uses the full balance as its accessible name', () => {
    const html = renderToStaticMarkup(
      createElement(AccountCreditsLink, { label: '120 credits', className: 'sm:hidden' }),
    );
    expect(html).toContain('data-slot="header-credits"');
    expect(html).toContain('href="/credits"');
    expect(html).toContain('aria-label="120 credits"');
    expect(html).toContain('sm:hidden');
    expect(html).toContain('120 credits');
  });
});
