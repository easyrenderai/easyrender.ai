import { expect, it, vi } from 'vitest';
import { convertFile } from './convert';

const mocks = vi.hoisted(() => ({
  dispose: vi.fn(),
  forceContextLoss: vi.fn(),
  loadModel: vi.fn(),
}));

vi.mock('three', async (importOriginal) => ({
  ...(await importOriginal<typeof import('three')>()),
  WebGLRenderer: class {
    dispose = mocks.dispose;
    forceContextLoss = mocks.forceContextLoss;
  },
}));
vi.mock('./load', () => ({ loadModel: mocks.loadModel }));

it('releases the temporary WebGL context when a model cannot be read', async () => {
  vi.stubGlobal('document', { createElement: () => ({}) });
  const file = new File(['invalid model'], 'broken.gltf');
  const failure = new Error('Failed to load model');
  mocks.loadModel.mockRejectedValueOnce(failure);

  try {
    await expect(convertFile([file], file, 'gltf', 'glb', 'broken', vi.fn())).rejects.toBe(failure);
    expect(mocks.dispose).toHaveBeenCalledOnce();
    expect(mocks.forceContextLoss).toHaveBeenCalledOnce();
  } finally {
    vi.unstubAllGlobals();
  }
});
