import { afterEach, expect, it, vi } from 'vitest';
import { resetWebGLProbe, WebGLUnavailableError } from '@/lib/webgl';
import { getStage } from './stage';

afterEach(() => {
  resetWebGLProbe();
  vi.unstubAllGlobals();
});

it("throws a typed error, not three.js's, when the browser has no WebGL", () => {
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) });
  expect(() => getStage()).toThrow(WebGLUnavailableError);
});
