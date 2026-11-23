/// <reference path="./fidelity/draco.d.ts" />
import { type Material, NodeIO, type Texture } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { simplify, weld } from '@gltf-transform/functions';
import draco from 'draco3dgltf';
import { MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

// The file a viewer opens. A generated GLB is made for downloading: PNG textures at the size the
// model was baked at, and on the High tier millions of triangles. A phone drawing a 600px box
// needs neither, and the page used to wait for all of it. This builds a lighter copy for viewing
// and AR, and the stored original stays what the owner downloads and what material edits start
// from. Material order is never changed, so an edit made by index lands on the same material in
// both files.

// Largest side of a colour texture and of every other texture (roughness, normals, occlusion).
const COLOR_SIZE = 2048;
const DATA_SIZE = 1024;
// A viewer redraws every frame; past this a phone struggles and nobody can tell the difference.
const MAX_TRIANGLES = 150_000;
const MAX_INPUT_BYTES = 64 * 1024 * 1024;

type Role = 'color' | 'data';

function roleOf(material: Material): Map<Texture, Role> {
  const roles = new Map<Texture, Role>();
  const add = (texture: Texture | null, role: Role) => {
    if (texture && !roles.has(texture)) roles.set(texture, role);
  };
  add(material.getBaseColorTexture(), 'color');
  add(material.getEmissiveTexture(), 'color');
  add(material.getMetallicRoughnessTexture(), 'data');
  add(material.getNormalTexture(), 'data');
  add(material.getOcclusionTexture(), 'data');
  return roles;
}

async function recompress(
  texture: Texture,
  role: Role,
  isOpaque: boolean,
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  const image = texture.getImage();
  if (!image) return null;
  const limit = role === 'color' ? COLOR_SIZE : DATA_SIZE;
  const pipeline = sharp(image, { limitInputPixels: 100_000_000 }).resize(limit, limit, {
    fit: 'inside',
    withoutEnlargement: true,
  });
  // A texture with real transparency keeps its alpha channel, so it stays a PNG.
  if (!isOpaque) {
    const bytes = await pipeline.png({ compressionLevel: 9 }).toBuffer();
    return { bytes, mimeType: 'image/png' };
  }
  const bytes = await pipeline
    .removeAlpha()
    .jpeg(
      role === 'color'
        ? { quality: 86, mozjpeg: true }
        : { quality: 90, mozjpeg: true, chromaSubsampling: '4:4:4' },
    )
    .toBuffer();
  return { bytes, mimeType: 'image/jpeg' };
}

function triangleCount(document: Awaited<ReturnType<NodeIO['readBinary']>>) {
  let count = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const indices = primitive.getIndices();
      const position = primitive.getAttribute('POSITION');
      count += (indices?.getCount() ?? position?.getCount() ?? 0) / 3;
    }
  }
  return count;
}

/**
 * A lighter GLB for viewing, or null when the file is already light, cannot be read, or would not
 * get smaller. Never throws: the original keeps working when this cannot help.
 */
export async function optimizeGlbForViewing(original: Uint8Array): Promise<Uint8Array | null> {
  if (original.byteLength > MAX_INPUT_BYTES) return null;
  try {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      'meshopt.decoder': MeshoptDecoder,
      'draco3d.decoder': await draco.createDecoderModule(),
    });
    const document = await io.readBinary(original);
    const root = document.getRoot();
    const materials = root.listMaterials();

    const roles = new Map<Texture, Role>();
    const opaque = new Map<Texture, boolean>();
    for (const material of materials) {
      for (const [texture, role] of roleOf(material)) {
        if (!roles.has(texture)) roles.set(texture, role);
        // Blended or masked materials read the colour texture's alpha.
        opaque.set(
          texture,
          (opaque.get(texture) ?? true) &&
            (role === 'data' || material.getAlphaMode() === 'OPAQUE'),
        );
      }
    }
    // A texture no material uses is dead weight (the generated file can carry one).
    for (const texture of root.listTextures()) {
      const isUsed = texture.listParents().some((parent) => parent !== root);
      if (!isUsed) texture.dispose();
    }
    for (const texture of root.listTextures()) {
      const role = roles.get(texture);
      // Textures used by an extension (clearcoat, sheen...) are left exactly as they are.
      if (!role) continue;
      const result = await recompress(texture, role, opaque.get(texture) ?? true);
      const before = texture.getImage()?.byteLength ?? 0;
      if (result && result.bytes.byteLength < before) {
        texture.setImage(result.bytes).setMimeType(result.mimeType);
      }
    }

    const triangles = triangleCount(document);
    if (triangles > MAX_TRIANGLES) {
      await MeshoptSimplifier.ready;
      await document.transform(
        weld(),
        simplify({
          simplifier: MeshoptSimplifier,
          ratio: MAX_TRIANGLES / triangles,
          error: 0.002,
          lockBorder: true,
        }),
      );
    }

    // Edits are stored by material index, so the copy must keep every material in place.
    if (root.listMaterials().length !== materials.length) return null;
    const output = await io.writeBinary(document);
    return output.byteLength < original.byteLength ? output : null;
  } catch {
    return null;
  }
}
