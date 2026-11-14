import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { LOCALES } from '@/i18n/config';
import de from '@/messages/de.json';
import en from '@/messages/en.json';
import es from '@/messages/es.json';
import fr from '@/messages/fr.json';
import itMessages from '@/messages/it.json';
import pt from '@/messages/pt.json';

// Every language answers for the same keys with the same ICU arguments, so a missing string can
// never throw on a live page and a price placeholder can never be replaced by a typed number.

const MESSAGES = { en, es, de, fr, it: itMessages, pt };

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === 'string') out.set(`${prefix}${key}`, value);
    else for (const [k, v] of flatten(value, `${prefix}${key}.`)) out.set(k, v);
  }
  return out;
}

const argumentsOf = (value: string) => [...value.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();

describe('the message files', () => {
  const reference = flatten(en);

  it('exist for every language', () => {
    expect(Object.keys(MESSAGES).sort()).toEqual([...LOCALES].sort());
  });

  // A translation may leave an argument out (Spanish does not need every number), but it may
  // never use one the code does not pass: that string would throw at render time.
  it.each(LOCALES)('%s has exactly the English keys, and no unknown ICU argument', (locale) => {
    const messages = flatten(MESSAGES[locale]);
    expect([...messages.keys()].sort()).toEqual([...reference.keys()].sort());
    for (const [key, value] of reference) {
      const allowed = argumentsOf(value);
      for (const name of argumentsOf(messages.get(key) ?? '')) {
        expect(allowed, `${locale}: ${key} uses {${name}}`).toContain(name);
      }
    }
  });

  it.each(['de', 'fr', 'it', 'pt'] as const)(
    '%s writes no credit amount by hand on the home',
    (locale) => {
      const home = JSON.stringify([
        MESSAGES[locale].Landing,
        MESSAGES[locale].Home,
        MESSAGES[locale].AgentDemo,
        MESSAGES[locale].Studio,
      ]);
      expect(home).not.toMatch(/\d[\d.,\s]*\s*(Credits|crédits|crediti|créditos)/i);
      expect(home).not.toMatch(/[$€]\s?\d|\d\s?(\$|€|USD)/);
    },
  );

  it('keeps pt in European Portuguese', () => {
    const text = JSON.stringify(pt);
    expect(text).not.toMatch(/\bvocê\b|\bcelular\b|\bbaixar\b|\bcadastr/i);
  });

  it.each(LOCALES)('%s names MRRAMOS INMUEBLES SL with its CIF and fiscal address', (locale) => {
    const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'Legal' });
    expect(t('operator.name')).toContain('MRRAMOS INMUEBLES SL');
    expect(t('operator.taxId')).toBe('CIF/NIF: B75763383');
    expect(t('operator.address')).toBe(
      'Registered address / domicilio fiscal: C/ San Miguel 13, Bajo B, 11001 Cádiz (Spain)',
    );
    expect(t('operator.contact')).toBe('Contact email: info@easyrender.ai');
    expect(t('terms.intro')).toContain('operated by MRRAMOS INMUEBLES SL');
    expect(t('terms.sections.law.body')).toContain('governed by Spanish law');
    expect(t('terms.sections.law.body')).toContain('courts of Spain');
    expect(t('privacy.sections.rights.body')).toContain(
      'Agencia Española de Protección de Datos (AEPD)',
    );
    const legal = JSON.stringify(MESSAGES[locale].Legal);
    expect(legal).not.toMatch(/Smithii|smithii\.io|Ras Al Khaimah|\bUAE\b|\bPDPL\b|\(ICO\)/);
    expect(legal).not.toMatch(/CIF_MRRAMOS|DOMICILIO_MRRAMOS|registered office/i);
  });
});
