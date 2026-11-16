import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => Object.assign((key: string) => key, { rich: (key: string) => key }),
}));
vi.mock('@/lib/analytics/browser', () => ({
  captureBrowser: vi.fn(),
  attribution: () => ({}),
  attributionHeaders: () => ({}),
  observeRender: vi.fn(),
  captureSignup: vi.fn(),
}));
vi.mock('@/lib/auth-client', () => ({ authClient: {} }));
vi.mock('@/components/analytics', () => ({ cookiesPath: () => '/cookies' }));

import { AuthFields } from '@/components/auth-fields';
import { PromptBar } from '@/components/prompt-bar';

it('offers existing examples directly without requiring an account or a generation', () => {
  const html = renderToStaticMarkup(createElement(PromptBar, { signedIn: false }));
  expect(html).toContain('href="/r/cmwceijqd000007l23vfjeftv"');
  expect(html).not.toContain('demo-armchair');
  expect(html).toContain('href="/r/demo-vase"');
  expect(html).toContain('optionalNotes');
  expect(html).not.toContain('name="name"');
});

it('only asks for email and password during email registration', () => {
  const html = renderToStaticMarkup(
    createElement(AuthFields, {
      mode: 'sign-up',
      onDone: () => {},
      callbackURL: () => '/r/example',
    }),
  );
  expect(html).toContain('name="email"');
  expect(html).toContain('name="password"');
  expect(html).not.toContain('name="name"');
});
