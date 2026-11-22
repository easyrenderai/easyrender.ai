import { classifyCountry } from '@easyrender/core/attribution';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, expect, it, vi } from 'vitest';
import { type ConsentChoice, readConsent } from './consent';

const state = vi.hoisted(() => ({
  country: 'US',
  isResolved: true,
  hasGpc: false,
  choice: { accepted: null, advertising: false } as ConsentChoice,
}));
vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', 'G-TEST000000');
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));
vi.mock('next/link', () => ({ default: () => null }));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }));
vi.mock('react', async (original) => {
  const react = await original<typeof import('react')>();
  return {
    ...react,
    useState: (initial: unknown) =>
      react.useState(
        initial === false
          ? state.isResolved
          : initial && typeof initial === 'object' && 'consent_region' in initial
            ? { ...initial, ...classifyCountry(state.country), gpc: state.hasGpc }
            : initial && typeof initial === 'object' && 'accepted' in initial
              ? state.choice
              : initial,
      ),
  };
});
const { Analytics } = await import('../../components/analytics');
afterAll(() => vi.unstubAllEnvs());
it.each(['US', 'MX', 'CA', 'AU', 'BR', 'IN', 'JP'])(
  'does not prompt standard-region visitors in %s',
  (country) => {
    state.country = country;
    expect(renderToStaticMarkup(createElement(Analytics))).not.toContain('consent-banner');
  },
);
it.each(['ES', 'DE', 'FR', 'IT', 'PT', 'NO', 'IS', 'LI', 'GB', 'CH', 'XX'])(
  'prompts unresolved-choice visitors in strict region %s',
  (country) => {
    state.country = country;
    expect(renderToStaticMarkup(createElement(Analytics))).toContain('consent-banner');
  },
);
it('does not prompt while geolocation is loading or when GPC is active', () => {
  state.country = 'ES';
  state.isResolved = false;
  expect(renderToStaticMarkup(createElement(Analytics))).not.toContain('consent-banner');
  state.isResolved = true;
  state.hasGpc = true;
  expect(renderToStaticMarkup(createElement(Analytics))).not.toContain('consent-banner');
  state.hasGpc = false;
});

it('offers only accept and reject with equal visual weight in the banner', () => {
  state.country = 'ES';
  const html = renderToStaticMarkup(createElement(Analytics));
  const buttons = [...html.matchAll(/<button\b([^>]*)>(.*?)<\/button>/g)];
  expect(buttons.map((button) => button[2])).toEqual(['accept', 'reject']);
  expect(buttons[0]?.[1]).toBe(buttons[1]?.[1]);
});

it('keeps analytics-only available on the cookie preferences page', async () => {
  const { CookiesPage } = await import('@/components/cookies-page');
  const html = renderToStaticMarkup(await CookiesPage());
  const buttons = [...html.matchAll(/<button\b[^>]*>(.*?)<\/button>/g)];
  expect(buttons.map((button) => button[1])).toEqual(['accept', 'reject', 'analyticsOnly']);
});

it.each([undefined, false])(
  'does not re-prompt a saved analytics-only choice (%s)',
  (advertising) => {
    state.country = 'ES';
    state.choice = readConsent(
      encodeURIComponent(
        JSON.stringify({
          version: 'v1',
          date: new Date().toISOString(),
          accepted: true,
          advertising,
        }),
      ),
    );
    expect(renderToStaticMarkup(createElement(Analytics))).not.toContain('consent-banner');
    state.choice = { accepted: null, advertising: false };
  },
);
