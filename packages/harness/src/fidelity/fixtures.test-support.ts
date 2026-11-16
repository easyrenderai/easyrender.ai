import { appendTexture, type GlbDocument, writeDocument } from './glb-document';
import { type Pixels, png } from './images';

export function imageFixture(): Pixels {
  const data = new Uint8Array(32 * 32 * 4).fill(255);
  for (let y = 4; y < 28; y++)
    for (let x = 4; x < 28; x++)
      data.set(x < 16 ? [180, 180, 180, 255] : [25, 25, 25, 255], (y * 32 + x) * 4);
  return { data, width: 32, height: 32 };
}
export async function fixture(name = 'brushed steel and black grips') {
  const values = new Float32Array([
    -1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 1, 1, 1, 0, 0,
    0,
  ]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  const binary = new Uint8Array(values.byteLength + indices.byteLength);
  binary.set(new Uint8Array(values.buffer));
  binary.set(new Uint8Array(indices.buffer), values.byteLength);
  const doc: GlbDocument = {
    binary,
    json: {
      asset: { version: '2.0' },
      buffers: [{ byteLength: binary.length }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 48 },
        { buffer: 0, byteOffset: 48, byteLength: 48 },
        { buffer: 0, byteOffset: 96, byteLength: 32 },
        { buffer: 0, byteOffset: 128, byteLength: 12 },
      ],
      accessors: [
        {
          bufferView: 0,
          componentType: 5126,
          count: 4,
          type: 'VEC3',
          min: [-1, -1, 0],
          max: [1, 1, 0],
        },
        { bufferView: 1, componentType: 5126, count: 4, type: 'VEC3' },
        { bufferView: 2, componentType: 5126, count: 4, type: 'VEC2' },
        { bufferView: 3, componentType: 5123, count: 6, type: 'SCALAR' },
      ],
      materials: [{ name, pbrMetallicRoughness: { roughnessFactor: 0.4, metallicFactor: 0 } }],
      meshes: [
        {
          primitives: [
            { attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 },
          ],
        },
      ],
      nodes: [{ mesh: 0, translation: [0, 0, 0] }],
      scenes: [{ nodes: [0] }],
      scene: 0,
    },
  };
  const photo = await png(imageFixture());
  const texture = appendTexture(doc, photo);
  const pbr = doc.json.materials?.[0].pbrMetallicRoughness;
  if (pbr) pbr.baseColorTexture = { index: texture };
  return { bytes: writeDocument(doc), photo };
}
