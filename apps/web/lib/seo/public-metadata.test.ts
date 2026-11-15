import { displayPricing } from '@easyrender/harness';
import { createTranslator } from 'next-intl';
import { type ComponentProps, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Pricing } from '@/components/landing';
import { ModelsView } from '@/components/models/models-view';
import { SiteFooter } from '@/components/site-footer';
import type { Locale } from '@/i18n/config';
import en from '@/messages/en.json';
import es from '@/messages/es.json';
import { softwareApplication } from './jsonld';
import * as pages from './pages';

const state = vi.hoisted(() => ({ locale: 'en' as Locale, currency: 'eur' as 'eur' | 'usd' }));
afterEach(() => {
  state.locale = 'en';
});
vi.mock('@/components/pricing/plan-cards', () => ({ PlanCards: () => null }));
vi.mock('@/components/pricing-exposure', () => ({ PricingExposure: () => null }));
vi.mock('@/components/site-link', () => ({
  SiteLink: (props: ComponentProps<'a'>) => createElement('a', props),
}));
vi.mock('@/lib/pricing', () => ({
  currentPricing: async () => displayPricing('control', state.currency),
}));
vi.mock('next-intl/server', () => ({
  getLocale: async () => state.locale,
  getTranslations: async (
    input: 'Footer' | 'Landing.pricing' | { locale: Locale; namespace: 'Models' | 'Analytics' },
  ) => {
    const locale = typeof input === 'string' ? state.locale : input.locale;
    const namespace = typeof input === 'string' ? input : input.namespace;
    return createTranslator({ locale, messages: locale === 'es' ? es : en, namespace });
  },
}));

describe('public pricing copy', () => {
  it('takes the shared pricing CTA to the real uploader from MCP and API landings', async () => {
    state.locale = 'es';
    const html = renderToStaticMarkup(await Pricing());
    expect(html).toContain('href="/es#try"');
    expect(html).not.toContain('href="#try"');
    state.locale = 'en';
  });
  it('structured offers match the EUR price shown on the pricing page', () => {
    const app = softwareApplication('es', 'Modelo 3D', 'control', 'eur');
    const offers = app.offers as { price: string; priceCurrency: string; url: string }[];
    expect(offers.every((offer) => offer.priceCurrency === 'EUR')).toBe(true);
    expect(offers.find((offer) => offer.price === '46.00')).toBeDefined();
    expect(offers.every((offer) => offer.url.endsWith('/es/precios'))).toBe(true);
  });

  it.each(['en', 'es'] as const)(
    'cookies has its own %s canonical and metadata',
    async (locale) => {
      const metadata = Reflect.get(pages, 'cookiesMetadata') as
        | ((locale: Locale) => Promise<{
            title?: unknown;
            alternates?: { canonical?: unknown; languages?: unknown };
          }>)
        | undefined;
      expect(metadata).toBeTypeOf('function');
      if (!metadata) return;
      const result = await metadata(locale);
      expect(result.alternates?.canonical).toBe(
        `https://easyrender.ai${locale === 'en' ? '' : '/es'}/cookies`,
      );
      expect(result.alternates?.languages).toMatchObject({
        en: 'https://easyrender.ai/cookies',
        es: 'https://easyrender.ai/es/cookies',
      });
      expect(String(result.title)).toContain(locale === 'es' ? 'Cookies y' : 'Cookies and');
    },
  );

  it('does not charge for the free draft or deduct its cost from a full build', async () => {
    const html = renderToStaticMarkup(await ModelsView({ locale: 'en' }));
    expect(html).not.toContain('€0.12');
    expect(html).not.toContain('€0.52');
    expect(html).toContain('€0.00');
    expect(html).toContain('€0.64');
  });

  it('the footer does not contradict EUR checkout prices', async () => {
    const html = renderToStaticMarkup(await SiteFooter());
    expect(html).not.toContain('Prices in USD.');
    expect(html).toContain('checkout');
  });

  it('makes the comparison hub and named author discoverable from public pages', async () => {
    const html = renderToStaticMarkup(await SiteFooter());
    expect(html).toContain('href="/compare"');
    expect(html).toContain('href="/authors/jorge-rodriguez"');
  });
});
