import { readFileSync } from 'node:fs';
import { Document, NodeIO } from '@gltf-transform/core';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { readGlbMaterials } from './glb';
import { optimizeGlbForViewing } from './glb-view';

const showcase = (name: string) =>
  new Uint8Array(
    readFileSync(new URL(`../../../apps/web/public/showcase/${name}.glb`, import.meta.url)),
  );

async function read(bytes: Uint8Array) {
  return new NodeIO().readBinary(bytes);
}

// A flat grid of `cells` x `cells` quads: 2 * cells^2 triangles, one material, one big texture.
async function grid(cells: number, options: { isBlended?: boolean } = {}) {
  const document = new Document();
  const buffer = document.createBuffer();
  const side = cells + 1;
  const position = new Float32Array(side * side * 3);
  const uv = new Float32Array(side * side * 2);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const i = y * side + x;
      position.set([x / cells, y / cells, Math.sin(x / 9) * Math.cos(y / 9) * 0.05], i * 3);
      uv.set([x / cells, y / cells], i * 2);
    }
  }
  const indices = new Uint32Array(cells * cells * 6);
  let n = 0;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const a = y * side + x;
      indices.set([a, a + 1, a + side, a + 1, a + side + 1, a + side], n);
      n += 6;
    }
  }
  const png = await sharp({
    create: {
      width: 3000,
      height: 3000,
      channels: 4,
      background: { r: 200, g: 120, b: 40, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  const texture = document.createTexture().setImage(new Uint8Array(png)).setMimeType('image/png');
  const unused = document.createTexture().setImage(new Uint8Array(png)).setMimeType('image/png');
  void unused;
  const material = document
    .createMaterial('part')
    .setBaseColorTexture(texture)
    .setAlphaMode(options.isBlended ? 'BLEND' : 'OPAQUE');
  const primitive = document
    .createPrimitive()
    .setAttribute(
      'POSITION',
      document.createAccessor().setType('VEC3').setArray(position).setBuffer(buffer),
    )
    .setAttribute(
      'TEXCOORD_0',
      document.createAccessor().setType('VEC2').setArray(uv).setBuffer(buffer),
    )
    .setIndices(document.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer))
    .setMaterial(material);
  const mesh = document.createMesh().addPrimitive(primitive);
  document.createScene().addChild(document.createNode().setMesh(mesh));
  return new NodeIO().writeBinary(document);
}

describe('the lighter GLB a viewer loads', () => {
  it('shrinks a generated model and keeps its materials where they were', async () => {
    const original = showcase('table');
    const light = await optimizeGlbForViewing(original);
    expect(light).not.toBeNull();
    expect(light?.byteLength).toBeLessThan(original.byteLength / 2);
    expect(readGlbMaterials(light as Uint8Array)).toEqual(readGlbMaterials(original));
    const document = await read(light as Uint8Array);
    const [texture] = document.getRoot().listTextures();
    expect(texture?.getMimeType()).toBe('image/jpeg');
  });

  it('leaves a model that is already light and anything that is not a GLB alone', async () => {
    expect(await optimizeGlbForViewing(new Uint8Array([1, 2, 3, 4]))).toBeNull();
    const light = await optimizeGlbForViewing(showcase('clay-vase'));
    if (light) expect(light.byteLength).toBeLessThan(showcase('clay-vase').byteLength);
  });

  it('caps the triangles and the texture size, and drops a texture nothing uses', async () => {
    const original = await grid(400);
    const light = await optimizeGlbForViewing(original);
    expect(light).not.toBeNull();
    const document = await read(light as Uint8Array);
    const triangles = document
      .getRoot()
      .listMeshes()
      .flatMap((mesh) => mesh.listPrimitives())
      .reduce((sum, primitive) => sum + (primitive.getIndices()?.getCount() ?? 0) / 3, 0);
    expect(triangles).toBeLessThanOrEqual(160_000);
    expect(triangles).toBeGreaterThan(40_000);
    const textures = document.getRoot().listTextures();
    expect(textures).toHaveLength(1);
    const image = textures[0]?.getImage() as Uint8Array;
    expect((await sharp(image).metadata()).width).toBe(2048);
    expect(
      document
        .getRoot()
        .listMaterials()
        .map((m) => m.getName()),
    ).toEqual(['part']);
  }, 60_000);

  it('keeps the alpha of a blended material as PNG', async () => {
    const light = await optimizeGlbForViewing(await grid(20, { isBlended: true }));
    const document = await read(light as Uint8Array);
    expect(document.getRoot().listTextures()[0]?.getMimeType()).toBe('image/png');
  }, 60_000);
});
