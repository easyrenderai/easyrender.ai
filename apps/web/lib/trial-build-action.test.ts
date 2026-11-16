import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { TrialBuildAction } from '@/components/trial-build-action';

vi.mock('@/lib/auth-client', () => ({ authClient: {} }));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));
const props = {
  fallback: createElement('a', { href: '/credits' }, 'Buy credits'),
  isBusy: false,
  next: encodeURIComponent('/r/own-model'),
  onBuild: () => {},
  onRefresh: () => {},
};
it('keeps control checkout intact and sends the offered signup back to its own preview', () => {
  expect(
    renderToStaticMarkup(createElement(TrialBuildAction, { ...props, offer: null })),
  ).toContain('/credits');
  const html = renderToStaticMarkup(
    createElement(TrialBuildAction, {
      ...props,
      offer: { variant: 'free_model', state: 'signup' },
    }),
  );
  expect(html).toContain('/sign-up?next=%2Fr%2Fown-model');
  expect(html).not.toContain('/credits');
});
it('requires verification before the free build action and disables a pending build', () => {
  const verify = renderToStaticMarkup(
    createElement(TrialBuildAction, {
      ...props,
      offer: { variant: 'free_model', state: 'verify' },
    }),
  );
  expect(verify).toContain('verify');
  expect(verify).not.toContain('>build<');
  const ready = renderToStaticMarkup(
    createElement(TrialBuildAction, {
      ...props,
      isBusy: true,
      offer: { variant: 'free_model', state: 'ready' },
    }),
  );
  expect(ready).toContain('disabled');
  expect(ready).not.toContain('/credits');
});
