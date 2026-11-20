// A valid binary glTF that clears the harness GLB guardrail (version 2, a matching declared
// length and at least 20 KB). It holds one triangle, padded with an unused buffer region.
export function minimalGlb(totalBytes = 24_576): Buffer {
  const positions = Buffer.alloc(36);
  for (const [index, value] of [0, 0, 0, 1, 0, 0, 0, 1, 0].entries()) {
    positions.writeFloatLE(value, index * 4);
  }
  const json = Buffer.from(
    JSON.stringify({
      asset: { version: '2.0', generator: 'easyrender-e2e-mock' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
      materials: [{ name: 'mock', pbrMetallicRoughness: { baseColorFactor: [0.4, 0.3, 0.2, 1] } }],
      accessors: [
        {
          bufferView: 0,
          componentType: 5126,
          count: 3,
          type: 'VEC3',
          min: [0, 0, 0],
          max: [1, 1, 0],
        },
      ],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
      buffers: [{ byteLength: totalBytes }],
    }),
  );
  const jsonPadded = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const binLength = totalBytes - 12 - 8 - jsonPadded.length - 8;
  const bin = Buffer.concat([positions, Buffer.alloc(binLength - positions.length)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalBytes, 8);
  const chunkHeader = (length: number, type: number) => {
    const buffer = Buffer.alloc(8);
    buffer.writeUInt32LE(length, 0);
    buffer.writeUInt32LE(type, 4);
    return buffer;
  };
  return Buffer.concat([
    header,
    chunkHeader(jsonPadded.length, 0x4e4f534a),
    jsonPadded,
    chunkHeader(bin.length, 0x004e4942),
    bin,
  ]);
}
