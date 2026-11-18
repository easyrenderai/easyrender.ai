import { classifyCountry } from '@easyrender/core/attribution';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ country: 'US', isResolved: true, hasGpc: false }));
vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', 'G-TEST000000');
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));
vi.mock('next/link', () => ({ default: () => null }));
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
