import { imageConfigDefault } from 'next/dist/shared/lib/image-config';
import imageLoader from 'next/dist/shared/lib/image-loader';
import { hasLocalMatch } from 'next/dist/shared/lib/match-local-pattern';
import { expect, it, vi } from 'vitest';
import nextConfig from '../next.config';
import { versionedPublicModel } from './public-models';

vi.mock('@sentry/nextjs/config', () => ({ withSentryConfig: (config: unknown) => config }));
vi.mock('next-intl/plugin', () => ({ default: () => (config: unknown) => config }));

const images = {
  ...imageConfigDefault,
  ...nextConfig.images,
  // Next's production config loader supplies this default when localPatterns is absent.
  localPatterns: nextConfig.images?.localPatterns ?? [{ pathname: '**', search: '' }],
};

it('renders the versioned showcase photo through the production image loader', () => {
  const src = versionedPublicModel('/showcase/armchair.jpg');
  const result = imageLoader({ config: images, src, width: 1080, quality: 85 });
  expect(new URL(result, 'https://easyrender.ai').searchParams.get('url')).toBe(src);
  expect(hasLocalMatch(images.localPatterns, src)).toBe(true);
});

it('keeps ordinary local photos allowed and rejects unrelated query strings', () => {
  expect(hasLocalMatch(images.localPatterns, '/showcase/vase.jpg')).toBe(true);
  expect(hasLocalMatch(images.localPatterns, '/studio/photos/armchair.jpg')).toBe(true);
  expect(hasLocalMatch(images.localPatterns, '/showcase/armchair.jpg?v=unexpected')).toBe(false);
  expect(hasLocalMatch(images.localPatterns, '/showcase/vase.jpg?v=3')).toBe(false);
});
