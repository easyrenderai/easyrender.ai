import { afterEach, expect, it, vi } from 'vitest';
import { prepare } from './prepare-image';

afterEach(() => vi.unstubAllGlobals());

it('uses a white backing for transparent photos at the resized dimensions', async () => {
  const bitmap = { width: 4096, height: 2048, close: vi.fn() };
  let backing = { color: '', width: 0, height: 0 };
  const context = {
    fillStyle: '',
    fillRect(_x: number, _y: number, width: number, height: number) {
      backing = { color: this.fillStyle, width, height };
    },
    drawImage: vi.fn(),
  };
  const canvas = {
    getContext: () => context,
    toBlob: (encode: BlobCallback) => encode(new Blob([JSON.stringify(backing)])),
  };
  vi.stubGlobal('document', { createElement: () => canvas });
  vi.stubGlobal('createImageBitmap', async () => bitmap);

  const image = await prepare(new File([], 'transparent.png'));
  expect(JSON.parse(await image.text())).toEqual({ color: 'white', width: 2048, height: 1024 });
  expect(bitmap.close).toHaveBeenCalledOnce();
});

it('reports an unreadable photo and releases the bitmap if the canvas is unavailable', async () => {
  const bitmap = { width: 24, height: 24, close: vi.fn() };
  const canvas = { getContext: () => null, toBlob: vi.fn() };
  vi.stubGlobal('document', { createElement: () => canvas });
  vi.stubGlobal('createImageBitmap', async () => bitmap);

  await expect(prepare(new File([], 'transparent.png'), 'Read failed')).rejects.toThrow(
    'Read failed',
  );
  expect(bitmap.close).toHaveBeenCalledOnce();
});
