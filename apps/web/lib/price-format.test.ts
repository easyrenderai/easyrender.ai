import { CREDIT_USD, RENDER_CREDITS } from '@easyrender/harness';
import { describe, expect, it } from 'vitest';
import { intlLocale } from '@/i18n/config';
import { faqText } from '@/lib/seo/llms';
import { formatCount, formatUsd } from './price-format';

// Intl reads a bare 'pt' as Brazil and puts the currency first ("US$ 0,20"). The site is Portugal
// only, so a Portuguese reader must see "0,20 US$", the same on the page, in the FAQPage data and
// in llms-full.txt.

const NBSP = /[  ]/g;
const plain = (value: string) => value.replace(NBSP, ' ');

describe('price formatting', () => {
  it('maps pt to pt-PT and leaves the other locales alone', () => {
    expect(intlLocale('pt')).toBe('pt-PT');
    for (const locale of ['en', 'es', 'de', 'fr', 'it']) expect(intlLocale(locale)).toBe(locale);
  });

  it('writes pt prices the Portuguese way, currency after the amount', () => {
    expect(plain(formatUsd('pt', 0.2))).toBe('0,20 US$');
    expect(plain(formatUsd('pt', 1234.5))).toBe('1234,50 US$');
    expect(formatUsd('pt', 0.2)).not.toMatch(/^US\$/);
  });

  it('keeps the other locales as they were', () => {
    expect(formatUsd('en', 0.2)).toBe('$0.20');
    expect(plain(formatUsd('fr', 0.2))).toBe('0,20 $US');
    expect(plain(formatUsd('de', 0.2))).toBe('0,20 $');
  });

  it('honours the fraction options the pricing cards pass', () => {
    expect(plain(formatUsd('pt', 29, { minimumFractionDigits: 0 }))).toBe('29 US$');
  });

  it('groups pt counts like Portugal, not Brazil', () => {
    expect(plain(formatCount('pt', 12000))).toBe('12 000');
  });

  it('fills the pt FAQ (llms-full.txt) with pt-PT prices', () => {
    const answers = faqText('pt')
      .map((item) => plain(item.answer))
      .join('\n');
    // The FAQ gives the credit rate, not a per-model conversion.
    expect(answers).not.toContain(plain(formatUsd('pt', RENDER_CREDITS * CREDIT_USD)));
    expect(answers).toContain('0,01 US$');
    expect(answers).not.toMatch(/US\$\s?\d/);
  });
});
