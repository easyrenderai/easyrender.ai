import { assessFidelity, improveMaterials, unavailableReport } from '@easyrender/harness/fidelity';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { finishMaterialFidelity } from './render-fidelity';
import { getFile, putFile } from './storage';

vi.mock('./storage', () => ({ getFile: vi.fn(), putFile: vi.fn() }));
vi.mock('./report', () => ({ reportError: vi.fn() }));
vi.mock('@easyrender/harness/fidelity', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@easyrender/harness/fidelity')>()),
  improveMaterials: vi.fn(),
  assessFidelity: vi.fn(),
}));
const render = { id: 'test', sourceKey: 'source', name: 'steel', prompt: null };
const original = new Uint8Array([1, 2, 3]);
const improved = new Uint8Array([4, 5, 6]);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getFile).mockResolvedValue(new Uint8Array([1]));
  vi.mocked(putFile).mockImplementation(async (path) => `local:${path}`);
  vi.mocked(improveMaterials).mockResolvedValue({
    bytes: improved,
    geometryHash: 'hash',
    materials: [],
    warnings: [],
  });
  vi.mocked(assessFidelity).mockResolvedValue({
    report: unavailableReport('review'),
    html: 'report',
  });
});
describe('pipeline fidelity is advisory', () => {
  it('returns corrected bytes and persists the flagged report beside the model', async () => {
    const result = await finishMaterialFidelity(original, render);
    expect(result.bytes).toEqual(improved);
    expect(result.fidelity.report.isFlagged).toBe(true);
    expect(result.fidelity.reportKey).toBe('local:quality/report.json');
    const stored = vi.mocked(putFile).mock.calls.find(([path]) => path === 'quality/report.json');
    expect(JSON.parse(new TextDecoder().decode(stored?.[1])).isFlagged).toBe(true);
  });
  it('preserves the original and flags review if a material operation or geometry guard fails', async () => {
    vi.mocked(improveMaterials).mockRejectedValue(new Error('Material pass changed geometry'));
    const result = await finishMaterialFidelity(original, render);
    expect(result.bytes).toEqual(original);
    expect(result.fidelity.report.warnings).toContain(
      'material_pass_unavailable_original_preserved',
    );
  });
  it('still returns a publishable model when source or QA storage is unavailable', async () => {
    vi.mocked(putFile).mockRejectedValue(new Error('storage unavailable'));
    const result = await finishMaterialFidelity(original, render);
    expect(result.bytes).toEqual(improved);
    expect(result.fidelity.report.warnings).toContain('qa_artifact_storage_failed');
    vi.mocked(getFile).mockRejectedValue(new Error('source unavailable'));
    const fallback = await finishMaterialFidelity(original, render);
    expect(fallback.bytes).toEqual(original);
    expect(fallback.fidelity.report.status).toBe('unavailable');
  });
});
