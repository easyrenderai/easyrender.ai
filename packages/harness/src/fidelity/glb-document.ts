import { createHash } from 'node:crypto';
import type { GLTF } from '@gltf-transform/core';

export type GlbDocument = { json: GLTF.IGLTF; binary: Uint8Array };
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

// Material edits append images to BIN. Never round-trip mesh data through an exporter.
export function readDocument(bytes: Uint8Array): GlbDocument {
  if (bytes.length < 28 || bytes.length > 64 * 1024 * 1024) throw new Error('GLB size unsupported');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    view.getUint32(0, true) !== 0x46546c67 ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== bytes.length
  )
    throw new Error('Invalid GLB header');
  const length = view.getUint32(12, true);
  const end = 20 + length;
  if (
    view.getUint32(16, true) !== JSON_CHUNK ||
    end + 8 > bytes.length ||
    view.getUint32(end + 4, true) !== BIN_CHUNK ||
    end + 8 + view.getUint32(end, true) !== bytes.length
  )
    throw new Error('Unsupported GLB chunks');
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, end))) as GLTF.IGLTF;
  if (json.buffers?.some((buffer) => buffer.uri)) throw new Error('External buffers unsupported');
  return { json, binary: new Uint8Array(bytes.subarray(end + 8)) };
}

export function writeDocument({ json, binary }: GlbDocument): Uint8Array {
  const body = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = Math.ceil(body.length / 4) * 4;
  const binLength = Math.ceil(binary.length / 4) * 4;
  const output = new Uint8Array(28 + jsonLength + binLength);
  const view = new DataView(output.buffer);
  [0x46546c67, 2, output.length, jsonLength, JSON_CHUNK].forEach((n, i) => {
    view.setUint32(i * 4, n, true);
  });
  output.fill(32, 20, 20 + jsonLength);
  output.set(body, 20);
  view.setUint32(20 + jsonLength, binLength, true);
  view.setUint32(24 + jsonLength, BIN_CHUNK, true);
  output.set(binary, 28 + jsonLength);
  return output;
}

export function viewBytes(doc: GlbDocument, index: number): Uint8Array {
  const view = doc.json.bufferViews?.[index];
  if (view?.buffer !== 0) throw new Error('Unsupported buffer view');
  const start = view.byteOffset ?? 0;
  if (start + view.byteLength > doc.binary.length) throw new Error('Truncated buffer view');
  return doc.binary.subarray(start, start + view.byteLength);
}

export function textureBytes(doc: GlbDocument, index: number): Uint8Array {
  const texture = doc.json.textures?.[index];
  const webp = texture?.extensions?.EXT_texture_webp as { source?: number } | undefined;
  const source = webp?.source ?? texture?.source;
  const image = source === undefined ? undefined : doc.json.images?.[source];
  if (image?.bufferView !== undefined) return viewBytes(doc, image.bufferView);
  if (image?.uri?.startsWith('data:image/') && image.uri.includes(';base64,'))
    return new Uint8Array(Buffer.from(image.uri.split(',')[1], 'base64'));
  throw new Error('Only embedded PNG, JPEG and WebP textures are supported');
}

export function appendTexture(doc: GlbDocument, bytes: Uint8Array, sampler?: number): number {
  const offset = Math.ceil(doc.binary.length / 4) * 4;
  const binary = new Uint8Array(offset + bytes.length);
  binary.set(doc.binary);
  binary.set(bytes, offset);
  doc.binary = binary;
  doc.json.bufferViews ??= [];
  const views = doc.json.bufferViews;
  doc.json.images ??= [];
  const images = doc.json.images;
  doc.json.textures ??= [];
  const textures = doc.json.textures;
  images.push({ bufferView: views.length, mimeType: 'image/png' });
  views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
  textures.push({ source: images.length - 1, ...(sampler === undefined ? {} : { sampler }) });
  if (!doc.json.buffers?.[0]) throw new Error('Missing GLB buffer');
  doc.json.buffers[0].byteLength = binary.length;
  return textures.length - 1;
}

// Includes all accessor metadata, sparse/interleaved payloads, meshopt/Draco bytes, topology,
// normals, every UV set, skin/animation data and the full node/scene transform hierarchy.
export function geometryHash(bytes: Uint8Array): string {
  const doc = readDocument(bytes);
  const { json } = doc;
  const imageViews = new Set(json.images?.map((image) => image.bufferView));
  const accessorViews = new Set(
    json.accessors?.flatMap((a) => [
      a.bufferView,
      a.sparse?.indices.bufferView,
      a.sparse?.values.bufferView,
    ]),
  );
  for (const mesh of json.meshes ?? [])
    for (const primitive of mesh.primitives) {
      const draco = primitive.extensions?.KHR_draco_mesh_compression as
        | { bufferView?: number }
        | undefined;
      if (draco?.bufferView !== undefined) accessorViews.add(draco.bufferView);
    }
  const hash = createHash('sha256');
  hash.update(
    JSON.stringify([
      json.accessors,
      json.meshes,
      json.nodes,
      json.scenes,
      json.scene,
      json.skins,
      json.animations,
    ]),
  );
  json.bufferViews?.forEach((view, index) => {
    if (imageViews.has(index) && !accessorViews.has(index)) return;
    hash.update(JSON.stringify([index, view]));
    const compressed = view.extensions?.EXT_meshopt_compression as
      | { buffer: number; byteOffset?: number; byteLength: number }
      | undefined;
    if (compressed) {
      if (compressed.buffer !== 0) throw new Error('External compressed geometry');
      const start = compressed.byteOffset ?? 0;
      if (start + compressed.byteLength > doc.binary.length) throw new Error('Truncated geometry');
      hash.update(doc.binary.subarray(start, start + compressed.byteLength));
    }
    // Meshopt fallback buffers can be virtual; only their metadata exists in the original.
    if (view.buffer === 0) hash.update(viewBytes(doc, index));
    else if (!compressed) throw new Error('External geometry');
  });
  return hash.digest('hex');
}

export function assertGeometryUnchanged(before: Uint8Array, after: Uint8Array): string {
  const hash = geometryHash(before);
  if (hash !== geometryHash(after)) throw new Error('Material pass changed geometry');
  return hash;
}
