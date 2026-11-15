import { createTranslator } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AgentDemo } from '@/components/agent-demo';
import { ApiDemo } from '@/components/integrations/api-demo';
import { formatCount } from '@/lib/price-format';
import en from '@/messages/en.json';
import es from '@/messages/es.json';

const pricing = vi.hoisted(() => ({ credits: 64 }));
vi.mock('@easyrender/harness', () => ({
  get RENDER_CREDITS() {
    return pricing.credits;
  },
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async ({
    locale,
    namespace,
  }: {
    locale: 'en' | 'es';
    namespace: 'AgentDemo' | 'IntegrationLanding.apiDemo';
  }) => createTranslator({ locale, messages: locale === 'es' ? es : en, namespace }),
}));

describe('illustrative integration demos', () => {
  it.each(['en', 'es'] as const)('keeps the %s budget tied to current pricing', async (locale) => {
    for (const credits of [64, 80]) {
      pricing.credits = credits;
      const html = renderToStaticMarkup(await AgentDemo({ locale }));
      expect(html).toContain(formatCount(locale, 24 * credits));
      expect(html).not.toContain('480');
      expect(html).not.toContain('USDZ');
      expect(html).not.toMatch(/\{(?:count|credits)\}/);
      expect(html).toContain(locale === 'es' ? 'no un lote generado' : 'not a completed batch');
    }
  });
  it('shows a partial API response without exposing a key or pretending to upload', async () => {
    pricing.credits = 80;
    const html = renderToStaticMarkup(await ApiDemo({ locale: 'en' }));
    expect(html).toContain('&quot;credits&quot;: 80');
    expect(html).toContain('partial JSON response');
    expect(html).toContain('sample ID, not a live render');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('Bearer');
  });
});
