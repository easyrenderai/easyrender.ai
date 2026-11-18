import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { AngleSheet } from '@/components/angle-sheet';
import { ModelViewer } from '@/components/model-viewer';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

it('shows accessible loading feedback before the viewer library or model is downloaded', () => {
  const html = renderToStaticMarkup(
    createElement(ModelViewer, { src: '/fixture.glb', alt: 'Chair' }),
  );
  expect(html).toContain('role="status"');
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain('modelLoading');
});

it('renders an eager angle image and loading feedback together', () => {
  const html = renderToStaticMarkup(createElement(AngleSheet, { src: '/fixture.png' }));
  expect(html).toContain('src="/fixture.png"');
  expect(html).toContain('loading="eager"');
  expect(html).toContain('role="status"');
  expect(html).toContain('sheetLoading');
});

it('labels the main download as an action and explains which format is for Apple', async () => {
  const { ModelView } = await import('@/components/model-view');
  const html = renderToStaticMarkup(
    createElement(ModelView, { src: '/fixture.glb', name: 'Chair', downloadUrl: '/fixture.glb' }),
  );
  expect(html).toContain('href="/fixture.glb"');
  expect(html).toContain('downloadGlb');
  expect(html).toContain('downloadUsdz');
  expect(html).not.toContain('BLEND');
});
