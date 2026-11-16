import { describe, expect, it } from 'vitest';
import { fixture, imageFixture } from './fixtures.test-support';
import { objectMask } from './images';
import { improveMaterials } from './materials';
import { assessFidelity, reportHtml, unavailableReport } from './qa';
import { readRenderScene, renderNeutral } from './renderer';

describe('headless fidelity QA', () => {
  it('renders a real triangle mesh, chooses a camera and writes a self-contained report', async () => {
    const { bytes, photo } = await fixture('wood');
    const fixed = await improveMaterials(bytes, photo);
    const result = await assessFidelity(fixed.bytes, photo);
    expect(result.report.status).toBe('measured');
    expect(result.report.camera?.method).toBe('silhouette-search');
    expect(result.report.color?.regions.length).toBeGreaterThan(0);
    expect(Number.isFinite(result.report.color?.meanDeltaE)).toBe(true);
    expect(result.comparison?.byteLength).toBeGreaterThan(100);
    expect(result.html).toContain('data:image/png;base64,');
    expect(result.html).toContain('Publication is never blocked');
  });
  it('flags flat maps, and an invalid model returns an advisory failure instead of throwing', async () => {
    const { bytes, photo } = await fixture('wood');
    const flat = await assessFidelity(bytes, photo, { azimuth: 0, elevation: 0 });
    expect(flat.report.status).toBe('measured');
    expect(flat.report.isFlagged).toBe(true);
    expect(flat.report.warnings).toContain('material_0:flat_roughness');
    const broken = await assessFidelity(new Uint8Array(32), photo);
    expect(broken.report).toMatchObject({ status: 'unavailable', isFlagged: true });
  });
  it('honours camera direction and produces transparent background', async () => {
    const { bytes } = await fixture();
    const scene = await readRenderScene(bytes);
    const front = renderNeutral(scene, 0, 0);
    const side = renderNeutral(scene, 90, 0);
    const coverage = (data: Uint8Array) => data.filter((v, i) => i % 4 === 3 && v > 0).length;
    expect(coverage(front.data)).toBeGreaterThan(1000);
    expect(coverage(side.data)).toBe(0);
    expect(front.data[3]).toBe(0);
  });
  it('removes connected background while retaining dark and bright object regions', () => {
    const image = imageFixture();
    const mask = objectMask(image);
    expect(mask[0]).toBe(0);
    expect(mask[8 * 32 + 8]).toBe(1);
    expect(mask[8 * 32 + 24]).toBe(1);
  });
  it('escapes report text in HTML', () => {
    const html = reportHtml(unavailableReport('<script>alert(1)</script>'));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
