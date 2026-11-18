import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { LOCALES } from '@/i18n/config';
import de from '@/messages/de.json';
import en from '@/messages/en.json';
import es from '@/messages/es.json';
import fr from '@/messages/fr.json';
import itMessages from '@/messages/it.json';
import pt from '@/messages/pt.json';

const MESSAGES = { en, es, de, fr, it: itMessages, pt };

describe('header credit balance copy', () => {
  it('pluralizes English, including zero and grouped thousands', () => {
    const t = createTranslator({ locale: 'en', messages: en, namespace: 'Header' });
    expect(t('creditsBalance', { count: 0 })).toBe('0 credits');
    expect(t('creditsBalance', { count: 1 })).toBe('1 credit');
    expect(t('creditsBalance', { count: 120 })).toBe('120 credits');
    expect(t('creditsBalance', { count: 1200 })).toBe('1,200 credits');
  });

  it.each(LOCALES)('%s uses a singular and a plural', (locale) => {
    const t = createTranslator({
      locale,
      messages: MESSAGES[locale],
      namespace: 'Header',
    });
    const one = t('creditsBalance', { count: 1 });
    const many = t('creditsBalance', { count: 2 });
    const none = t('creditsBalance', { count: 0 });
    expect(one).not.toBe(many);
    expect(none).not.toBe(one);
    expect(none.length).toBeGreaterThan(0);
    expect(one).toMatch(/1/);
    expect(many).toMatch(/2/);
    expect(t('creditsLink').length).toBeGreaterThan(0);
    expect(t('accountMenu').length).toBeGreaterThan(0);
  });
});
