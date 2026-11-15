import { describe, expect, it } from 'vitest';
import { LOCALES } from '@/i18n/config';
import { equivalentPaths, pickerPaths } from './equivalents';
import { ROUTES } from './routes';

const homes = LOCALES.map((locale) => ROUTES.home.paths[locale]);

describe('pickerPaths', () => {
  it('lists a page in every language it is live in', () => {
    expect(pickerPaths('/es').map((option) => option.path)).toEqual(homes);
  });

  it('links the pricing page in all six languages', () => {
    expect(equivalentPaths('/pricing').map((option) => option.path)).toEqual([
      '/pricing',
      '/es/precios',
      '/de/preise',
      '/fr/tarifs',
      '/it/prezzi',
      '/pt/precos',
    ]);
    expect(equivalentPaths('/es/precios').map((option) => option.locale)).toEqual(LOCALES);
  });

  it('links the comparisons hub in every language', () => {
    expect(equivalentPaths('/compare').map((option) => option.path)).toEqual([
      '/compare',
      '/es/comparativas',
      '/de/vergleich',
      '/fr/comparatifs',
      '/it/confronti',
      '/pt/comparacoes',
    ]);
    expect(pickerPaths('/de/vergleich/vergleich-meshy').map((option) => option.locale)).toEqual(
      LOCALES,
    );
  });

  it('falls back to the homes for the signed-in app', () => {
    for (const path of ['/dashboard', '/library', '/connectors', '/account', '/hub', '/sign-in'])
      expect(pickerPaths(path).length, path).toBe(LOCALES.length);
  });
});
