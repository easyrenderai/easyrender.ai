import {
  assessFidelity,
  type FidelityReport,
  improveMaterials,
  reportHtml,
  unavailableReport,
} from '@easyrender/harness/fidelity';
import { reportError } from './report';
import { getFile, putFile } from './storage';

export type StoredFidelity = {
  report: FidelityReport;
  reportKey?: string;
  htmlKey?: string;
  comparisonKey?: string;
};

// This is deliberately separate from generation guardrails: neither an uncertain material,
// a QA warning nor a failed QA/storage operation can fail/refund an otherwise valid model.
export async function finishMaterialFidelity(
  original: Uint8Array,
  render: { id: string; sourceKey: string; name: string | null; prompt: string | null },
): Promise<{ bytes: Uint8Array; fidelity: StoredFidelity }> {
  let bytes = original;
  const warnings: string[] = [];
  try {
    const source = await getFile(render.sourceKey);
    const context = [render.name, render.prompt].filter(Boolean).join('. ');
    try {
      const improved = await improveMaterials(original, source, context);
      bytes = improved.bytes;
      warnings.push(...improved.warnings);
    } catch (error) {
      warnings.push('material_pass_unavailable_original_preserved');
      reportError(error, { renderId: render.id, stage: 'material_fidelity' });
    }
    const artifacts = await assessFidelity(bytes, source, { context });
    artifacts.report.warnings.push(...warnings);
    artifacts.report.isFlagged ||= warnings.length > 0;
    const fidelity: StoredFidelity = { report: artifacts.report };
    try {
      if (artifacts.comparison)
        fidelity.comparisonKey = await putFile(
          'quality/comparison.png',
          artifacts.comparison,
          'image/png',
        );
      fidelity.htmlKey = await putFile(
        'quality/report.html',
        new TextEncoder().encode(reportHtml(artifacts.report, artifacts.comparison)),
        'text/html; charset=utf-8',
      );
      fidelity.reportKey = await putFile(
        'quality/report.json',
        new TextEncoder().encode(JSON.stringify(artifacts.report)),
        'application/json',
      );
    } catch (error) {
      fidelity.report.isFlagged = true;
      fidelity.report.warnings.push('qa_artifact_storage_failed');
      reportError(error, { renderId: render.id, stage: 'fidelity_artifacts' });
    }
    return { bytes, fidelity };
  } catch (error) {
    reportError(error, { renderId: render.id, stage: 'fidelity_qa' });
    return {
      bytes,
      fidelity: { report: unavailableReport('fidelity_unavailable_review_manually') },
    };
  }
}
