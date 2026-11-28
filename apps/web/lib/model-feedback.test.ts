import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { rating: number }) =>
    values ? `${key} ${values.rating}` : key,
}));
vi.mock('@/lib/analytics/browser', () => ({ captureModelFeedback: vi.fn() }));

import { ModelFeedback } from '@/components/model-feedback';

it('renders an inline labelled keyboard radio group, dismiss action and live region', () => {
  const html = renderToStaticMarkup(createElement(ModelFeedback, { renderId: 'fixture' }));
  expect(html).toContain('role="radiogroup"');
  expect(html.match(/role="radio"/g)).toHaveLength(5);
  expect(html).toContain('aria-label="stars 1"');
  expect(html).toContain('aria-label="stars 5"');
  expect(html).toContain('aria-label="close"');
  expect(html).toContain('aria-live="polite"');
  expect(html).not.toContain('role="dialog"');
  expect(html).not.toContain('textarea');
});
