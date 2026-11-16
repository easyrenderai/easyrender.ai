import { describe, expect, it } from 'vitest';
import { LOCALES } from '@/i18n/config';
import { ROUTES } from '@/lib/seo/routes';
import { headerPrimaryAction } from '@/lib/site-navigation';

describe('primary marketing action', () => {
  it('uploads on every home even for returning signed-in users', () => {
    for (const locale of LOCALES) {
      for (const isSignedIn of [false, true]) {
        expect(headerPrimaryAction(locale, ROUTES.home.paths[locale], isSignedIn)).toEqual({
          kind: 'upload',
          href: `${ROUTES.home.paths[locale]}#try`,
        });
      }
    }
  });
  it('keeps each integration focused on its own setup after navigation', () => {
    for (const locale of ['en', 'es'] as const) {
      for (const kind of ['api', 'mcp'] as const) {
        for (const isSignedIn of [false, true]) {
          const path = ROUTES[kind].paths[locale];
          expect(headerPrimaryAction(locale, path, isSignedIn)).toEqual({
            kind,
            href: `${path}#connect`,
          });
        }
      }
    }
  });
  it('preserves dashboard access elsewhere and never offers unpublished integration setup', () => {
    expect(headerPrimaryAction('es', '/es/precios', true)).toEqual({
      kind: 'dashboard',
      href: '/dashboard',
    });
    expect(headerPrimaryAction('fr', '/fr/mcp', false)).toEqual({
      kind: 'upload',
      href: '/fr#try',
    });
  });
});
