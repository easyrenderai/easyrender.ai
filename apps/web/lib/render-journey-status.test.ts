import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

import { RenderJourneyStatus } from '@/components/render-journey-status';

it('uses a distinct paid correction status when an earlier sheet is being replaced', () => {
  const html = renderToStaticMarkup(
    createElement(RenderJourneyStatus, {
      status: 'drafting',
      hasPreview: false,
      isCorrecting: true,
    }),
  );
  expect(html).toContain('correctingTitle');
  expect(html).not.toContain('draftingTitle');
});
