import { describe, expect, it } from 'vitest';
import { LOCALES } from '@/i18n/config';
import { headerSectionHref, siteNavigation } from '@/lib/site-navigation';
import de from '@/messages/de.json';
import en from '@/messages/en.json';
import es from '@/messages/es.json';
import fr from '@/messages/fr.json';
import itMessages from '@/messages/it.json';
import pt from '@/messages/pt.json';

// The header (components/site-header.tsx) is one row at every width. Its fit was measured in
// Chromium at 320, 360, 390, 414, 768, 1024, 1280 and 1440px in all six languages (PR "fix:
// header overflow"), and again once the language links became a dropdown that is always in the
// row. These budgets keep a later copy change from overflowing it again without a new browser
// check. Headroom with the dropdown: the phone CTA has 36px left at 320px (de, 15 characters),
// the full CTA 219px at 768px (fr), the desktop row 155px at 1280px (pt, 78). Section links stay
// at xl: at 1024px they would leave pt only 27px. Signed in, the row is the dropdown, Dashboard and
// the menu below 640px (the balance is no longer shown in the header), measured the same way: fr "Tableau de
// bord" leaves 5px at 320px and 8px at 414px, where the wordmark shows, and the desktop row 170px
// at 1280px. Raising a budget means re-measuring first.
const MAX_PHONE_CTA = 18; // Header.connect, the only label between the language dropdown and the menu below 640px
const MAX_FULL_CTA = 22; // Header.connect + " " + Header.connectSuffix, from 640px
const MAX_DESKTOP_ROW = 80; // every Header.nav label + signIn + the full CTA, from 1280px
const MAX_DASHBOARD = 15; // Header.dashboard, next to the language dropdown below 640px when signed in
const MAX_SIGNED_IN_ROW = 75; // every Header.nav label + dashboard, from 1280px

const MESSAGES = { en, es, de, fr, it: itMessages, pt };

describe('the header labels', () => {
  it('keeps integration anchors on the current page after navigation', () => {
    for (const path of ['/es/api-imagen-a-3d', '/es/mcp']) {
      expect(headerSectionHref('es', path, '#connect')).toBe(`${path}#connect`);
      expect(headerSectionHref('es', path, '#how-it-works')).toBe(`${path}#how-it-works`);
      expect(headerSectionHref('es', path, '#try')).toBe('/es#try');
    }
    expect(headerSectionHref('en', '/mcp', '#connect')).toBe('/mcp#connect');
    expect(headerSectionHref('en', '/', '#connect')).toBe('/#connect');
    expect(headerSectionHref('fr', '/fr/mcp', '#connect')).toBe('/fr#connect');
  });
  it('exposes API and MCP only for published languages', () => {
    for (const locale of LOCALES) {
      const keys = siteNavigation(locale).map(({ key }) => key);
      expect(keys.includes('mcp')).toBe(['en', 'es'].includes(locale));
      expect(keys.includes('api')).toBe(['en', 'es'].includes(locale));
      expect(keys.includes('connect')).toBe(!['en', 'es'].includes(locale));
    }
  });
  it.each(LOCALES)('%s fits the measured header widths', (locale) => {
    const header = MESSAGES[locale].Header;
    const fullCta = [header.connect, header.connectSuffix].filter(Boolean).join(' ');
    const row =
      siteNavigation(locale)
        .map(({ key }) => header.nav[key])
        .join('') +
      header.signIn +
      fullCta;
    expect(header.upload.length, `${locale}: Header.upload`).toBeLessThanOrEqual(MAX_PHONE_CTA);
    expect(header.connect.length, `${locale}: Header.connect`).toBeLessThanOrEqual(MAX_PHONE_CTA);
    expect(fullCta.length, `${locale}: connect + connectSuffix`).toBeLessThanOrEqual(MAX_FULL_CTA);
    expect(row.length, `${locale}: desktop row`).toBeLessThanOrEqual(MAX_DESKTOP_ROW);
  });

  it.each(LOCALES)('%s fits the measured signed-in header widths', (locale) => {
    const header = MESSAGES[locale].Header;
    const row =
      siteNavigation(locale)
        .map(({ key }) => header.nav[key])
        .join('') + header.dashboard;
    expect(header.dashboard.length, `${locale}: Header.dashboard`).toBeLessThanOrEqual(
      MAX_DASHBOARD,
    );
    expect(row.length, `${locale}: signed-in desktop row`).toBeLessThanOrEqual(MAX_SIGNED_IN_ROW);
  });
});
