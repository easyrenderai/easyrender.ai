import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import es from '@/messages/es.json';

const catalogs = { en: en.MailingEmails, es: es.MailingEmails };
const routes = [
  'ecommerce',
  'furniture',
  'agency',
  'api',
  'mcp',
  'product_views',
  'method_fit',
  'formats',
  'general',
];
const days = ['00', '02', '05', '10', '20', '28'];

describe('the registration email catalog', () => {
  it('does not include monetary amounts even in hypothetical agency or API examples', () => {
    for (const locale of ['en', 'es'] as const) {
      for (const id of ['agency_d20', 'api_d20'] as const) {
        expect(catalogs[locale][id].body).not.toMatch(/[€$£]|\b(?:EUR|USD|euros?|dollars?)\b/i);
      }
    }
  });
  it.each(['es', 'en'] as const)(
    '%s covers all nine routes and six registration days',
    (locale) => {
      const catalog = catalogs[locale];
      const expectedIds = routes.flatMap((route) => days.map((day) => `${route}_d${day}`));
      expect(Object.keys(catalog).sort()).toEqual(expectedIds.sort());
      for (const [id, copy] of Object.entries(catalog)) {
        for (const field of ['subject', 'preheader', 'body', 'action'] as const) {
          expect(copy[field].trim(), `${locale}/${id}/${field}`).not.toBe('');
        }
      }
    },
  );

  it.each(['es', 'en'] as const)(
    '%s includes the commercial exercise exactly once in the body recipients receive',
    (locale) => {
      for (const [id, copy] of Object.entries(catalogs[locale])) {
        if (!/^(ecommerce|furniture|agency)_/.test(id)) continue;
        expect(copy.body.split(copy.action).length - 1, `${locale}/${id}`).toBe(1);
      }
    },
  );
});
