import { createTranslator } from 'next-intl';
import { beforeEach, expect, it, vi } from 'vitest';
import en from '@/messages/en.json';

const state = vi.hoisted(() => ({ getRender: vi.fn() }));
vi.mock('@easyrender/core', async (original) => ({
  ...(await original<typeof import('@easyrender/core')>()),
  getRender: state.getRender,
}));
vi.mock('@/lib/actor', () => ({ resolveViewerActor: async () => ({}) }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('404');
  },
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => createTranslator({ locale: 'en', messages: en }),
}));

import { AppError } from '@easyrender/core';
import { generateMetadata } from '@/app/(render)/r/[id]/page';

const metadata = () =>
  generateMetadata({
    params: Promise.resolve({ id: 'test-render' }),
    searchParams: Promise.resolve({}),
  });
beforeEach(() => vi.clearAllMocks());
it('gives a published model its own social title and preview', async () => {
  state.getRender.mockResolvedValue({
    id: 'test-render',
    name: 'Oak chair',
    isPublic: true,
    status: 'ready',
    glbKey: 'model',
    sheetKey: 'sheet',
  });
  expect(await metadata()).toMatchObject({
    title: 'Oak chair · Easy Render',
    openGraph: {
      title: 'Oak chair · Easy Render',
      images: [{ url: 'https://easyrender.ai/api/renders/test-render/preview' }],
    },
  });
});
it('uses a localized model label when unnamed and omits absent previews', async () => {
  state.getRender.mockResolvedValue({
    id: 'test-render',
    name: null,
    isPublic: true,
    status: 'ready',
    glbKey: 'model',
    sheetKey: null,
    sourceKey: null,
  });
  const result = await metadata();
  expect(result.title).toBe('3D model · Easy Render');
  expect(result.openGraph).toMatchObject({ images: [] });
});
it('never publishes private names or images, even for an authenticated owner', async () => {
  state.getRender.mockResolvedValue({
    id: 'test-render',
    name: 'Private product',
    isPublic: false,
    status: 'ready',
    glbKey: 'model',
    sheetKey: 'secret',
  });
  const result = await metadata();
  expect(result.title).toBe('3D model · Easy Render');
  expect(result.openGraph).toBeUndefined();
  expect(JSON.stringify(result)).not.toContain('Private product');
  expect(JSON.stringify(result)).not.toContain('/preview');
});
it('keeps denied or nonexistent renders at 404', async () => {
  state.getRender.mockRejectedValue(new AppError('Not found', 404, 'not_found'));
  await expect(metadata()).rejects.toThrow('404');
});

it('keeps long public model names within the title budget', async () => {
  state.getRender.mockResolvedValue({
    id: 'test-render',
    name: 'Long product name '.repeat(7),
    isPublic: true,
    status: 'ready',
    glbKey: 'model',
    sheetKey: 'sheet',
  });
  const result = await metadata();
  expect(String(result.title).length).toBeLessThanOrEqual(60);
  expect(result.openGraph).toMatchObject({ title: result.title });
});
it('withholds social cards until a public render is actually publicly viewable', async () => {
  state.getRender.mockResolvedValue({
    id: 'test-render',
    name: 'Unpublished preview',
    isPublic: true,
    status: 'preview_ready',
    glbKey: null,
    sheetKey: 'sheet',
  });
  const result = await metadata();
  expect(result.openGraph).toBeUndefined();
  expect(result.title).toBe('3D model · Easy Render');
});
