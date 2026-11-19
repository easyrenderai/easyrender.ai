import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it('throws a typed error when the browser has no WebGL', async () => {
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) });
  const { WebGLUnavailableError } = await import('@/lib/webgl');
  const { getStage } = await import('./stage');

  expect(() => getStage()).toThrow(WebGLUnavailableError);
});

it('handles renderer context denial without retrying across studio sections', async () => {
  const createElement = vi.fn(() => ({
    getContext: (_type: string, attributes?: object) =>
      attributes ? null : { getExtension: () => null },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal('document', { createElement });
  const { WebGLUnavailableError } = await import('@/lib/webgl');
  const { getStage } = await import('./stage');

  expect(() => getStage()).toThrow(WebGLUnavailableError);
  expect(() => getStage()).toThrow(WebGLUnavailableError);
  expect(createElement).toHaveBeenCalledOnce();
});
