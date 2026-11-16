import { expect, it } from 'vitest';
import { needsDocumentNavigation } from './locale-navigation';

it('reloads locale layouts across the Hub boundary and a home redirect', () => {
  expect(needsDocumentNavigation('/hub', 'es', '/es')).toBe(true);
  expect(needsDocumentNavigation('/', 'en', '/hub')).toBe(true);
  expect(needsDocumentNavigation('/#try', 'en', '/pricing')).toBe(true);
  expect(needsDocumentNavigation('/es', 'en', '/hub')).toBe(true);
  expect(needsDocumentNavigation('/sign-up', 'fr', '/fr/tarifs')).toBe(true);
});
it('keeps same-language navigation and in-page anchors on the client router', () => {
  expect(needsDocumentNavigation('#try', 'es', '/es')).toBe(false);
  expect(needsDocumentNavigation('/es/precios', 'es', '/es')).toBe(false);
  expect(needsDocumentNavigation('/#try', 'en', '/')).toBe(false);
});
