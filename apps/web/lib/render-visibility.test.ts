import type { RenderView as View } from '@easyrender/core';
import { NextIntlClientProvider } from 'next-intl';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { QueryProvider } from '@/components/query-provider';
import { RenderView } from '@/components/render-view';
import en from '@/messages/en.json';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

it.each([false, true])('shows stored isPublic=%s without changing existing renders', (isPublic) => {
  const initial: View = {
    id: 'qa-fixture',
    status: 'preview_ready',
    prompt: null,
    name: 'QA fixture',
    error: null,
    hasPreview: true,
    hasSheet: false,
    sheetNote: null,
    hasModel: false,
    modelVersion: 1,
    credits: 0,
    renderCredits: 64,
    sheetCredits: 20,
    upscaleCredits: 10,
    canUpscale: false,
    isPublic,
    source: 'web',
    createdAt: '2026-11-17T10:00:00Z',
  };
  const html = renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale: 'en',
      messages: en,
      timeZone: 'UTC',
      // biome-ignore lint/correctness/noChildrenProp: next-intl requires children in the typed provider props
      children: createElement(
        QueryProvider,
        null,
        createElement(RenderView, {
          initial,
          edits: [],
          now: Date.parse(initial.createdAt),
          signedIn: true,
          balance: 0,
          owner: true,
        }),
      ),
    }),
  );
  expect(html).toMatch(new RegExp(`role="switch"[^>]*aria-checked="${isPublic}"`));
  expect(html).toContain('Show in public gallery');
  expect(html).toContain('Loading angle sheet');
});
