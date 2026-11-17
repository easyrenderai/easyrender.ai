import { afterEach, expect, it, vi } from 'vitest';
import { hasWebGL, resetWebGLProbe } from './webgl';

afterEach(() => {
  resetWebGLProbe();
  vi.unstubAllGlobals();
});

const stubDocument = (getContext: (kind: string) => unknown) =>
  vi.stubGlobal('document', { createElement: () => ({ getContext }) });

it('is false without a document (server render)', () => {
  expect(hasWebGL()).toBe(false);
});

it('is false when the browser cannot create a WebGL context', () => {
  stubDocument(() => null);
  expect(hasWebGL()).toBe(false);
});

it('is false when creating the context throws', () => {
  stubDocument(() => {
    throw new Error('blocked');
  });
  expect(hasWebGL()).toBe(false);
});

it('is true when a context exists, and releases the probe context', () => {
  const loseContext = vi.fn();
  stubDocument((kind) => (kind === 'webgl2' ? { getExtension: () => ({ loseContext }) } : null));
  expect(hasWebGL()).toBe(true);
  expect(loseContext).toHaveBeenCalledOnce();
});

it('falls back to webgl1 and caches the answer', () => {
  const getContext = vi.fn((kind: string) =>
    kind === 'webgl' ? { getExtension: () => null } : null,
  );
  stubDocument(getContext);
  expect(hasWebGL()).toBe(true);
  expect(hasWebGL()).toBe(true);
  expect(getContext).toHaveBeenCalledTimes(2);
});
