/// <reference path="./draco.d.ts" />
import { type Material, NodeIO, type Texture, type TextureInfo } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco from 'draco3dgltf';
import { MeshoptDecoder } from 'meshoptimizer';
import { linear, srgb } from './color';
import { readDocument } from './glb-document';
import { type Pixels, pixels } from './images';

export type Vec = [number, number, number];
type Vertex = { position: Vec; normal: Vec | null; uv: number[]; mrUv: number[] };
type Surface = {
  index: number;
  hasUv: boolean;
  isDoubleSided: boolean;
  color: Pixels | null;
  mr: Pixels | null;
  factor: number[];
  metallic: number;
  roughness: number;
  colorInfo: TextureInfo | null;
  mrInfo: TextureInfo | null;
};
type Triangle = { vertices: Vertex[]; surface: Surface };
export type RenderScene = { triangles: Triangle[]; warnings: string[] };
const normalize = (a: Vec): Vec => {
  const length = Math.hypot(...a) || 1;
  return a.map((x) => x / length) as Vec;
};
const subtract = (a: Vec, b: Vec): Vec => a.map((v, i) => v - b[i]) as Vec;
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vec, b: Vec) => a.reduce((sum, v, i) => sum + v * b[i], 0);

export async function readRenderScene(bytes: Uint8Array, textureSize = 256): Promise<RenderScene> {
  const raw = readDocument(bytes);
  if (raw.json.images?.some((image) => image.uri && !image.uri.startsWith('data:image/')))
    throw new Error('External QA images are not fetched');
  if (
    (raw.json.buffers ?? []).reduce((sum, buffer) => sum + buffer.byteLength, 0) >
      128 * 1024 * 1024 ||
    (raw.json.accessors ?? []).some((a) => a.count > 2_000_000) ||
    (raw.json.materials?.length ?? 0) > 64
  )
    throw new Error('QA decoded resource budget exceeded');
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'draco3d.decoder': await draco.createDecoderModule(),
  });
  const doc = await io.readBinary(bytes);
  const textures = new Map<Texture, Pixels>();
  const sample = async (texture: Texture | null) => {
    if (!texture) return null;
    if (!textures.has(texture)) {
      const image = texture.getImage();
      if (!image) throw new Error('Missing texture');
      textures.set(texture, await pixels(image, textureSize));
    }
    return textures.get(texture) ?? null;
  };
  const surfaces = new Map<Material | null, Surface>();
  const surface = async (material: Material | null) => {
    let result = surfaces.get(material);
    if (!result) {
      result = {
        index: material ? doc.getRoot().listMaterials().indexOf(material) : -1,
        hasUv: true,
        isDoubleSided: material?.getDoubleSided() ?? false,
        color: await sample(material?.getBaseColorTexture() ?? null),
        mr: await sample(material?.getMetallicRoughnessTexture() ?? null),
        factor: material?.getBaseColorFactor() ?? [1, 1, 1, 1],
        metallic: material?.getMetallicFactor() ?? 1,
        roughness: material?.getRoughnessFactor() ?? 1,
        colorInfo: material?.getBaseColorTextureInfo() ?? null,
        mrInfo: material?.getMetallicRoughnessTextureInfo() ?? null,
      };
      surfaces.set(material, result);
    }
    return result;
  };
  const triangles: Triangle[] = [];
  const warnings: string[] = [];
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  if (!scene) throw new Error('No scene');
  const nodes: import('@gltf-transform/core').Node[] = [];
  scene.traverse((node) => nodes.push(node));
  for (const node of nodes) {
    if (node.getSkin()) throw new Error('Skinned QA rendering unsupported');
    const matrix = node.getWorldMatrix();
    // Cofactors of the world 3x3 give inverse-transpose directions (normalised afterwards).
    const columns: Vec[] = [
      [matrix[0], matrix[1], matrix[2]],
      [matrix[4], matrix[5], matrix[6]],
      [matrix[8], matrix[9], matrix[10]],
    ];
    const cofactors = [
      cross(columns[1], columns[2]),
      cross(columns[2], columns[0]),
      cross(columns[0], columns[1]),
    ];
    const sign = Math.sign(dot(columns[0], cofactors[0])) || 1;
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      if (primitive.getMode() !== 4 || primitive.listTargets().length)
        throw new Error('Only static triangle QA rendering is supported');
      const positions = primitive.getAttribute('POSITION');
      const normals = primitive.getAttribute('NORMAL');
      if (!positions) continue;
      const indices = primitive.getIndices();
      const count = indices?.getCount() ?? positions.getCount();
      if (triangles.length + count / 3 > 200_000) throw new Error('QA triangle budget exceeded');
      const material = primitive.getMaterial();
      if (material?.getAlphaMode() === 'BLEND') warnings.push('transparent_material_approximation');
      const s = await surface(material);
      const uv = primitive.getAttribute(`TEXCOORD_${s.colorInfo?.getTexCoord() ?? 0}`);
      if (!uv) s.hasUv = false;
      if (primitive.getAttribute('COLOR_0')) warnings.push('vertex_colors_unsupported');
      const mrUv = primitive.getAttribute(`TEXCOORD_${s.mrInfo?.getTexCoord() ?? 0}`);
      for (let i = 0; i < count; i += 3) {
        const vertices: Vertex[] = [];
        for (let j = 0; j < 3; j++) {
          const index = indices?.getScalar(i + j) ?? i + j;
          const p = positions.getElement(index, []);
          const position = [0, 1, 2].map(
            (axis) =>
              matrix[axis] * p[0] +
              matrix[axis + 4] * p[1] +
              matrix[axis + 8] * p[2] +
              matrix[axis + 12],
          ) as Vec;
          const rawNormal = normals?.getElement(index, []);
          const normal = rawNormal
            ? normalize(
                [0, 1, 2].map(
                  (axis) =>
                    sign * cofactors.reduce((sum, col, i) => sum + col[axis] * rawNormal[i], 0),
                ) as Vec,
              )
            : null;
          vertices.push({
            position,
            normal,
            uv: uv?.getElement(index, []) ?? [0, 0],
            mrUv: mrUv?.getElement(index, []) ?? [0, 0],
          });
        }
        triangles.push({ vertices, surface: s });
      }
    }
  }
  if (!triangles.length) throw new Error('No triangles');
  return { triangles, warnings: [...new Set(warnings)] };
}

function texel(texture: Pixels | null, uv: number[], info: TextureInfo | null): number[] {
  if (!texture) return [1, 1, 1, 1];
  const transform =
    info?.getExtension<import('@gltf-transform/extensions').Transform>('KHR_texture_transform');
  let [u, v] = uv;
  if (transform) {
    const scale = transform.getScale(),
      offset = transform.getOffset(),
      angle = transform.getRotation();
    const x = u * scale[0],
      y = v * scale[1];
    u = Math.cos(angle) * x - Math.sin(angle) * y + offset[0];
    v = Math.sin(angle) * x + Math.cos(angle) * y + offset[1];
  }
  const wrap = (value: number, mode: number) =>
    mode === 33071
      ? Math.max(0, Math.min(0.999999, value))
      : mode === 33648
        ? 1 - Math.abs((((value % 2) + 2) % 2) - 1)
        : ((value % 1) + 1) % 1;
  const x = Math.min(
    texture.width - 1,
    Math.floor(wrap(u, info?.getWrapS() ?? 10497) * texture.width),
  );
  const y = Math.min(
    texture.height - 1,
    Math.floor(wrap(v, info?.getWrapT() ?? 10497) * texture.height),
  );
  return [
    ...texture.data.subarray((y * texture.width + x) * 4, (y * texture.width + x) * 4 + 4),
  ].map((c) => c / 255);
}

export type FidelityCamera = { azimuth: number; elevation: number; distance?: number };
export type RenderView = {
  image: Pixels;
  depth: Float64Array;
  triangle: Int32Array;
  gain: Float32Array;
  bias: Float32Array;
  eye: Vec;
  pixelWorldSize: number;
  project: (position: Vec) => Vec;
};

// A bounded software rasterizer. Distance is in object-width units; omitted = orthographic.
// Captured depth and triangle IDs allow visibility-checked transfer to the original UV atlas.
export function renderView(scene: RenderScene, camera: FidelityCamera, size = 192): RenderView {
  const start = Date.now();
  const theta = (camera.azimuth * Math.PI) / 180,
    phi = (camera.elevation * Math.PI) / 180;
  const eye: Vec = [
    Math.sin(theta) * Math.cos(phi),
    Math.sin(phi),
    Math.cos(theta) * Math.cos(phi),
  ];
  const right = normalize(cross([0, 1, 0], eye)),
    up = cross(eye, right);
  const low = [Infinity, Infinity, Infinity],
    high = [-Infinity, -Infinity, -Infinity];
  for (const triangle of scene.triangles)
    for (const v of triangle.vertices)
      for (let c = 0; c < 3; c++) {
        low[c] = Math.min(low[c], v.position[c]);
        high[c] = Math.max(high[c], v.position[c]);
      }
  const origin = low.map((v, i) => (v + high[i]) / 2) as Vec;
  const extent = Math.max(...high.map((v, i) => v - low[i]), 0.0001);
  const distance = camera.distance ? Math.max(1, camera.distance) * extent : Infinity;
  const rawProject = (position: Vec): Vec => {
    const p = subtract(position, origin),
      z = dot(p, eye);
    const perspective = Number.isFinite(distance) ? distance / (distance - z) : 1;
    return [dot(p, right) * perspective, dot(p, up) * perspective, z];
  };
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const triangle of scene.triangles)
    for (const v of triangle.vertices) {
      const [x, y] = rawProject(v.position);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  const scale = (size - 12) / Math.max(maxX - minX, maxY - minY, 0.0001);
  const center = [(minX + maxX) / 2, (minY + maxY) / 2];
  const project = (position: Vec): Vec => {
    const p = rawProject(position);
    return [(p[0] - center[0]) * scale + size / 2, size / 2 - (p[1] - center[1]) * scale, p[2]];
  };
  const output = new Uint8Array(size * size * 4);
  const depth = new Float64Array(size * size).fill(-Infinity);
  const triangleIds = new Int32Array(size * size).fill(-1);
  const gain = new Float32Array(size * size),
    bias = new Float32Array(size * size);
  const edge = (a: Vec, b: Vec, x: number, y: number) =>
    (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
  for (let t = 0; t < scene.triangles.length; t++) {
    if (t % 1000 === 0 && Date.now() - start > 4000) throw new Error('QA raster budget exceeded');
    const { vertices, surface } = scene.triangles[t];
    const v = vertices.map(({ position }) => project(position));
    const area = edge(v[0], v[1], v[2][0], v[2][1]);
    if (Math.abs(area) < 1e-8) continue;
    const n = normalize(
      cross(
        subtract(vertices[1].position, vertices[0].position),
        subtract(vertices[2].position, vertices[0].position),
      ),
    );
    if (!surface.isDoubleSided && dot(n, eye) <= 0) continue;
    const bounds = [
      Math.max(0, Math.floor(Math.min(...v.map((p) => p[0])))),
      Math.min(size - 1, Math.ceil(Math.max(...v.map((p) => p[0])))),
      Math.max(0, Math.floor(Math.min(...v.map((p) => p[1])))),
      Math.min(size - 1, Math.ceil(Math.max(...v.map((p) => p[1])))),
    ];
    for (let y = bounds[2]; y <= bounds[3]; y++)
      for (let x = bounds[0]; x <= bounds[1]; x++) {
        let w = [
          edge(v[1], v[2], x + 0.5, y + 0.5) / area,
          edge(v[2], v[0], x + 0.5, y + 0.5) / area,
          edge(v[0], v[1], x + 0.5, y + 0.5) / area,
        ];
        if (w.some((a) => a < 0)) continue;
        if (Number.isFinite(distance)) {
          w = w.map((a, i) => a / (distance - v[i][2]));
          const total = w.reduce((sum, a) => sum + a, 0);
          w = w.map((a) => a / total);
        }
        const z = w.reduce((sum, a, i) => sum + a * v[i][2], 0),
          p = y * size + x;
        if (z <= depth[p]) continue;
        const interpolate = (key: 'uv' | 'mrUv') =>
          [0, 1].map((c) => w.reduce((sum, a, i) => sum + a * vertices[i][key][c], 0));
        const color = texel(surface.color, interpolate('uv'), surface.colorInfo);
        if (color[3] * surface.factor[3] < 0.5) continue;
        const mr = texel(surface.mr, interpolate('mrUv'), surface.mrInfo);
        const rough = mr[1] * surface.roughness,
          metal = mr[2] * surface.metallic;
        const normal = normalize(
          [0, 1, 2].map((axis) =>
            w.reduce((sum, weight, i) => sum + weight * (vertices[i].normal ?? n)[axis], 0),
          ) as Vec,
        );
        const facing = Math.abs(dot(normal, eye));
        const lighting = 0.72 + 0.28 * Math.abs(dot(normal, normalize([0.4, 0.8, 0.5])));
        const highlight = (1 - rough) * 0.18 * facing ** (4 + (1 - rough) * 20);
        gain[p] = lighting * (1 - 0.1 * metal) + highlight * metal;
        bias[p] = highlight * 0.04 * (1 - metal);
        for (let c = 0; c < 3; c++) {
          const value = linear(color[c]) * surface.factor[c] * gain[p] + bias[p];
          output[p * 4 + c] = Math.round(255 * Math.max(0, Math.min(1, srgb(value))));
        }
        output[p * 4 + 3] = 255;
        depth[p] = z;
        triangleIds[p] = t;
      }
  }
  return {
    image: { data: output, width: size, height: size },
    depth,
    triangle: triangleIds,
    gain,
    bias,
    eye,
    pixelWorldSize: extent / (size - 12),
    project,
  };
}

export function renderNeutral(
  scene: RenderScene,
  azimuth: number,
  elevation = 15,
  size = 192,
): Pixels {
  return renderView(scene, { azimuth, elevation }, size).image;
}
