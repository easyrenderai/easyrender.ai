import * as THREE from 'three';
import { type ExportedFile, exportModel } from './export';
import { type ExportFormat, isZUpFormat, type ViewerFormat } from './formats';
import { loadModel, MissingFilesError } from './load';
import { materialsOf, texturesOf } from './stats';

// Converts a file without showing it: read, re-orient, write. Used by the converter page, where
// the visitor wants the new file and nothing else. Runs in the browser; nothing is uploaded.

export type ConvertStage = 'reading' | 'converting';

function probeRenderer(): THREE.WebGLRenderer | null {
  // Only needed to decode KTX2 textures; a browser without WebGL still converts everything else.
  try {
    return new THREE.WebGLRenderer({ canvas: document.createElement('canvas') });
  } catch {
    return null;
  }
}

export async function convertFile(
  files: readonly File[],
  main: File,
  from: ViewerFormat,
  to: ExportFormat,
  name: string,
  onStage: (stage: ConvertStage) => void,
): Promise<ExportedFile> {
  onStage('reading');
  const renderer = probeRenderer();
  const loaded = await loadModel(files, main, from, renderer);
  try {
    // Textures are part of what GLB, GLTF, USDZ and OBJ carry over: without them the result
    // would silently lose its colours, so stop and name the files instead.
    if (loaded.missing.length > 0) throw new MissingFilesError(loaded.missing);
    onStage('converting');
    // Stand a Z-up source upright, then lay the result back down for a Z-up target.
    const pivot = new THREE.Group();
    pivot.rotation.x = (isZUpFormat(from) ? -Math.PI / 2 : 0) + (isZUpFormat(to) ? Math.PI / 2 : 0);
    pivot.add(loaded.object);
    pivot.updateMatrixWorld(true);
    return await exportModel(pivot, loaded.animations, to, name);
  } finally {
    const materials = materialsOf(loaded.object);
    for (const texture of texturesOf(materials)) texture.dispose();
    for (const material of materials) material.dispose();
    loaded.object.traverse((node) => {
      (node as THREE.Mesh).geometry?.dispose();
    });
    loaded.release();
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
}
