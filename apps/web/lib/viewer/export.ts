import * as THREE from 'three';
import type { ExportFormat } from './formats';
import { materialsOf } from './stats';

// Writes the open model in another format, in the browser. Each exporter is imported on demand.
// FBX is not here: there is no browser exporter for it, so the viewer opens FBX but cannot write it.

export type ExportedFile = { blob: Blob; extension: string };

type ColorMaterial = THREE.Material & {
  color?: THREE.Color;
  map?: THREE.Texture | null;
  opacity: number;
};

// A material name OBJ and MTL can both carry: no spaces, and unique within the file.
function nameMaterials(materials: readonly THREE.Material[]) {
  const taken = new Set<string>();
  for (const [index, material] of materials.entries()) {
    let name = material.name.trim().replace(/\s+/g, '_') || `material_${index + 1}`;
    while (taken.has(name)) name = `${name}_${index + 1}`;
    taken.add(name);
    material.name = name;
  }
}

// A texture as an image file: JPEG, or PNG when the material needs its alpha channel. glTF images
// are stored top row first and OBJ reads them bottom row first, so an image three.js did not flip
// on upload is flipped here and the UVs stay as they are.
async function textureImage(
  texture: THREE.Texture,
  hasAlpha: boolean,
): Promise<{ bytes: Uint8Array; extension: string } | null> {
  const image = texture.image as CanvasImageSource & { width?: number; height?: number };
  const isCompressed = (texture as THREE.CompressedTexture).isCompressedTexture === true;
  if (!image?.width || !image.height || isCompressed) return null;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  try {
    if (!texture.flipY) {
      context.translate(0, canvas.height);
      context.scale(1, -1);
    }
    context.drawImage(image, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, hasAlpha ? 'image/png' : 'image/jpeg', 0.92),
    );
    if (!blob) return null;
    return { bytes: new Uint8Array(await blob.arrayBuffer()), extension: hasAlpha ? 'png' : 'jpg' };
  } catch {
    return null;
  }
}

// OBJ keeps its colours and textures in a .mtl file and image files next to it, so a model with
// materials is delivered as one .zip holding all of them. A bare shape stays a single .obj.
async function exportObj(root: THREE.Object3D, name: string): Promise<ExportedFile> {
  const [{ OBJExporter }, { zipSync, strToU8 }] = await Promise.all([
    import('three/addons/exporters/OBJExporter.js'),
    import('three/addons/libs/fflate.module.js'),
  ]);
  // OBJ and MTL separate their fields with spaces, so the files they name cannot contain one.
  const base = name.trim().replace(/\s+/g, '_') || 'model';
  const materials = materialsOf(root) as ColorMaterial[];
  nameMaterials(materials);
  const obj = new OBJExporter().parse(root);

  const files: Record<string, Uint8Array> = {};
  const images = new Map<THREE.Texture, string>();
  const lines: string[] = [];
  for (const material of materials) {
    const color = material.color ?? new THREE.Color(1, 1, 1);
    lines.push(
      `newmtl ${material.name}`,
      // MTL colours are sRGB values, three.js keeps them linear.
      `Kd ${color
        .clone()
        .convertLinearToSRGB()
        .toArray()
        .map((value) => value.toFixed(4))
        .join(' ')}`,
      `d ${material.opacity.toFixed(4)}`,
    );
    if (material.map) {
      let file = images.get(material.map);
      if (!file) {
        const hasAlpha = material.transparent || material.alphaTest > 0;
        const image = await textureImage(material.map, hasAlpha);
        if (image) {
          file = `${base}_${images.size + 1}.${image.extension}`;
          images.set(material.map, file);
          files[file] = image.bytes;
        }
      }
      if (file) lines.push(`map_Kd ${file}`);
    }
    lines.push('');
  }

  const hasMaterials = materials.some((material) => material.map || material.color);
  if (!hasMaterials) return { blob: new Blob([obj], { type: 'model/obj' }), extension: 'obj' };
  files[`${base}.obj`] = strToU8(`mtllib ${base}.mtl\n${obj}`);
  files[`${base}.mtl`] = strToU8(lines.join('\n'));
  const zip = zipSync(files);
  return { blob: new Blob([zip as BlobPart], { type: 'application/zip' }), extension: 'zip' };
}

// USDZ only describes the standard PBR material, so anything else (the Phong materials of OBJ and
// FBX files, a point cloud) is exported on a copy that carries its colour and texture across.
function withStandardMaterials(root: THREE.Object3D): THREE.Object3D {
  const copy = root.clone(true);
  const converted = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  copy.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    const convert = (material: THREE.Material) => {
      if ((material as THREE.MeshStandardMaterial).isMeshStandardMaterial) return material;
      let standard = converted.get(material);
      if (!standard) {
        const source = material as ColorMaterial;
        standard = new THREE.MeshStandardMaterial({
          name: material.name,
          color: source.color ?? 0xffffff,
          map: source.map ?? null,
          opacity: source.opacity,
          transparent: material.transparent,
          side: material.side,
        });
        converted.set(material, standard);
      }
      return standard;
    };
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(convert)
      : convert(mesh.material);
  });
  return copy;
}

/**
 * `root` is exported with its world transform, so the caller places it where the file should
 * have it (upright, at its own origin) before calling.
 */
export async function exportModel(
  root: THREE.Object3D,
  animations: THREE.AnimationClip[],
  format: ExportFormat,
  name: string,
): Promise<ExportedFile> {
  if (format === 'glb' || format === 'gltf') {
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    const result = await new GLTFExporter().parseAsync(root, {
      binary: format === 'glb',
      animations,
      onlyVisible: false,
    });
    return result instanceof ArrayBuffer
      ? { blob: new Blob([result], { type: 'model/gltf-binary' }), extension: 'glb' }
      : {
          blob: new Blob([JSON.stringify(result)], { type: 'model/gltf+json' }),
          extension: 'gltf',
        };
  }
  if (format === 'obj') return exportObj(root, name);
  if (format === 'stl') {
    const { STLExporter } = await import('three/addons/exporters/STLExporter.js');
    const data = new STLExporter().parse(root, { binary: true });
    return { blob: new Blob([data as BlobPart], { type: 'model/stl' }), extension: 'stl' };
  }
  if (format === 'ply') {
    const { PLYExporter } = await import('three/addons/exporters/PLYExporter.js');
    const data = await new Promise<ArrayBuffer | string | null>((resolve) => {
      new PLYExporter().parse(root, resolve, { binary: true });
    });
    if (!data) throw new Error('Nothing to export');
    return { blob: new Blob([data], { type: 'application/octet-stream' }), extension: 'ply' };
  }
  const { USDZExporter } = await import('three/addons/exporters/USDZExporter.js');
  const copy = withStandardMaterials(root);
  copy.updateMatrixWorld(true);
  const bytes = await new USDZExporter().parseAsync(copy);
  return { blob: new Blob([bytes as BlobPart], { type: 'model/vnd.usdz+zip' }), extension: 'usdz' };
}
