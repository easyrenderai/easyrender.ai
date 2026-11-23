// Reads and edits the materials of a binary glTF without decoding it. A generated model is one
// GLB; a user's material changes are a small list of factors kept beside it, and this file is the
// only place that turns the two into a new GLB. Only the JSON chunk is rewritten: the geometry and
// the texture bytes are copied as they are, so the original file is never touched and an edit can
// always be reset. No Node and no sharp in here, so the browser can import it too.

export type Rgb = [number, number, number];

// One entry per glTF material. `index` is the position in the file's `materials` array: it is the
// stable key of a part's material.
export type GlbMaterial = {
  index: number;
  // The name in the file, or null when the file has none (the editor then numbers it).
  name: string | null;
  baseColor: Rgb;
  roughness: number;
  metalness: number;
};

// What a user changed on one material. Missing fields stay as the file has them. `baseColor` is a
// tint that multiplies the baked colour texture, which is how glTF defines baseColorFactor.
export type MaterialEdit = {
  index: number;
  baseColor?: Rgb;
  roughness?: number;
  metalness?: number;
};

// Finishes a user can start from. They set shine, not colour, because the generated colour lives
// in the baked texture. Ids match the material profiles of the sheet prompt (materials.ts).
export const FINISHES = [
  { id: 'stone', roughness: 0.25, metalness: 0 },
  { id: 'wood', roughness: 0.65, metalness: 0 },
  { id: 'metal', roughness: 0.3, metalness: 1 },
] as const;

export type FinishId = (typeof FINISHES)[number]['id'];

export const MAX_MATERIALS = 64;

const MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a; // "JSON"
const HEADER = 12;
const CHUNK_HEADER = 8;

type Json = {
  materials?: {
    name?: string;
    pbrMetallicRoughness?: {
      baseColorFactor?: number[];
      metallicFactor?: number;
      roughnessFactor?: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }[];
  [key: string]: unknown;
};

type Parsed = { json: Json; jsonEnd: number; view: DataView };

function parse(bytes: Uint8Array): Parsed | null {
  if (bytes.byteLength < HEADER + CHUNK_HEADER) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== MAGIC || view.getUint32(4, true) !== 2) return null;
  if (view.getUint32(8, true) !== bytes.byteLength) return null;
  const length = view.getUint32(HEADER, true);
  const jsonEnd = HEADER + CHUNK_HEADER + length;
  if (view.getUint32(HEADER + 4, true) !== JSON_CHUNK || jsonEnd > bytes.byteLength) return null;
  try {
    const text = new TextDecoder().decode(bytes.subarray(HEADER + CHUNK_HEADER, jsonEnd));
    return { json: JSON.parse(text) as Json, jsonEnd, view };
  } catch {
    return null;
  }
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round = (value: number) => Math.round(clamp01(value) * 1000) / 1000;

// The materials of a GLB, with the glTF defaults filled in (white, fully rough and fully metallic
// when a file leaves the factors out). Empty when the file cannot be read.
export function readGlbMaterials(bytes: Uint8Array): GlbMaterial[] {
  const parsed = parse(bytes);
  if (!parsed) return [];
  return (parsed.json.materials ?? []).map((material, index) => {
    const pbr = material.pbrMetallicRoughness ?? {};
    const color = pbr.baseColorFactor ?? [1, 1, 1, 1];
    return {
      index,
      name: material.name?.trim() || null,
      baseColor: [round(color[0] ?? 1), round(color[1] ?? 1), round(color[2] ?? 1)],
      roughness: round(pbr.roughnessFactor ?? 1),
      metalness: round(pbr.metallicFactor ?? 1),
    };
  });
}

// Validates what a client sent. Unknown shapes are dropped, numbers are clamped to 0..1, an index
// outside the file is rejected as a whole, and the last edit of a material wins.
export function sanitizeMaterialEdits(
  input: unknown,
  materialCount: number,
): MaterialEdit[] | null {
  if (!Array.isArray(input) || input.length > MAX_MATERIALS) return null;
  const byIndex = new Map<number, MaterialEdit>();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') return null;
    const entry = raw as Record<string, unknown>;
    const index = entry.index;
    if (
      typeof index !== 'number' ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= materialCount
    )
      return null;
    const edit: MaterialEdit = { index };
    if (entry.roughness !== undefined) {
      if (typeof entry.roughness !== 'number' || !Number.isFinite(entry.roughness)) return null;
      edit.roughness = round(entry.roughness);
    }
    if (entry.metalness !== undefined) {
      if (typeof entry.metalness !== 'number' || !Number.isFinite(entry.metalness)) return null;
      edit.metalness = round(entry.metalness);
    }
    if (entry.baseColor !== undefined) {
      const color = entry.baseColor;
      if (
        !Array.isArray(color) ||
        color.length !== 3 ||
        !color.every((channel) => typeof channel === 'number' && Number.isFinite(channel))
      )
        return null;
      edit.baseColor = [round(color[0]), round(color[1]), round(color[2])];
    }
    // An edit that changes nothing is not stored.
    if (edit.roughness !== undefined || edit.metalness !== undefined || edit.baseColor)
      byIndex.set(index, edit);
  }
  return [...byIndex.values()].sort((a, b) => a.index - b.index);
}

// The GLB with its (edited) JSON chunk written back; the binary chunk after it is copied as it is.
function repack(bytes: Uint8Array, { json, jsonEnd }: Parsed): Uint8Array {
  // JSON chunks are padded with spaces to a 4-byte boundary.
  const body = new TextEncoder().encode(JSON.stringify(json));
  const padded = Math.ceil(body.byteLength / 4) * 4;
  const rest = bytes.subarray(jsonEnd);
  const out = new Uint8Array(HEADER + CHUNK_HEADER + padded + rest.byteLength);
  out.set(bytes.subarray(0, HEADER + CHUNK_HEADER));
  out.set(body, HEADER + CHUNK_HEADER);
  out.fill(0x20, HEADER + CHUNK_HEADER + body.byteLength, HEADER + CHUNK_HEADER + padded);
  out.set(rest, HEADER + CHUNK_HEADER + padded);
  const view = new DataView(out.buffer);
  view.setUint32(8, out.byteLength, true);
  view.setUint32(HEADER, padded, true);
  return out;
}

// A new GLB with the edits applied to its materials. Returns the same bytes when there is nothing
// to apply or the file cannot be read, so a caller can always serve the result.
export function applyMaterialEdits(bytes: Uint8Array, edits: MaterialEdit[]): Uint8Array {
  if (edits.length === 0) return bytes;
  const parsed = parse(bytes);
  if (!parsed) return bytes;
  const { json } = parsed;
  const materials = json.materials ?? [];
  let changed = false;
  for (const edit of edits) {
    const material = materials[edit.index];
    if (!material) continue;
    const pbr = { ...(material.pbrMetallicRoughness ?? {}) };
    if (edit.baseColor) {
      const alpha = pbr.baseColorFactor?.[3] ?? 1;
      pbr.baseColorFactor = [...edit.baseColor, alpha];
    }
    if (edit.roughness !== undefined) pbr.roughnessFactor = edit.roughness;
    if (edit.metalness !== undefined) pbr.metallicFactor = edit.metalness;
    material.pbrMetallicRoughness = pbr;
    changed = true;
  }
  if (!changed) return bytes;
  return repack(bytes, parsed);
}

// The real size of a piece, in centimetres, as its owner or its store gave it. Each side is
// optional; the AR page needs at least one to show the piece at that size.
export type RealSize = { widthCm?: number; depthCm?: number; heightCm?: number };

export const MIN_SIDE_CM = 1;
export const MAX_SIDE_CM = 10000;

// The size to keep, or null when the input is not a size. An empty object or null clears it.
// Anything else that is not a list of sides between 1 cm and 100 m is refused as undefined.
export function sanitizeRealSize(input: unknown): RealSize | null | undefined {
  if (input === null) return null;
  if (typeof input !== 'object' || Array.isArray(input)) return undefined;
  const record = input as Record<string, unknown>;
  const size: RealSize = {};
  for (const key of ['widthCm', 'depthCm', 'heightCm'] as const) {
    const value = record[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    if (value < MIN_SIDE_CM || value > MAX_SIDE_CM) return undefined;
    size[key] = Math.round(value * 10) / 10;
  }
  return Object.keys(size).length === 0 ? null : size;
}

type Matrix = number[];
type GltfNode = {
  mesh?: number;
  children?: number[];
  matrix?: number[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
};
type Gltf = Json & {
  scene?: number;
  scenes?: { nodes?: number[] }[];
  nodes?: GltfNode[];
  meshes?: { primitives?: { attributes?: { POSITION?: number } }[] }[];
  accessors?: { min?: number[]; max?: number[] }[];
};

const IDENTITY: Matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// Column-major 4x4 product a * b, the order glTF uses.
function multiply(a: Matrix, b: Matrix): Matrix {
  const out = new Array<number>(16).fill(0);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += (a[k * 4 + row] ?? 0) * (b[column * 4 + k] ?? 0);
      out[column * 4 + row] = sum;
    }
  }
  return out;
}

function localMatrix(node: GltfNode): Matrix {
  if (node.matrix?.length === 16) return node.matrix;
  const [x = 0, y = 0, z = 0] = node.translation ?? [];
  const [qx = 0, qy = 0, qz = 0, qw = 1] = node.rotation ?? [];
  const [sx = 1, sy = 1, sz = 1] = node.scale ?? [];
  return [
    (1 - 2 * (qy * qy + qz * qz)) * sx,
    2 * (qx * qy + qz * qw) * sx,
    2 * (qx * qz - qy * qw) * sx,
    0,
    2 * (qx * qy - qz * qw) * sy,
    (1 - 2 * (qx * qx + qz * qz)) * sy,
    2 * (qy * qz + qx * qw) * sy,
    0,
    2 * (qx * qz + qy * qw) * sz,
    2 * (qy * qz - qx * qw) * sz,
    (1 - 2 * (qx * qx + qy * qy)) * sz,
    0,
    x,
    y,
    z,
    1,
  ];
}

// The size of a GLB's geometry in metres, as an axis-aligned box in the scene's own axes (glTF is
// Y up, so `height` is the vertical extent). Null when the file cannot be read or has no geometry.
export function measureGlb(
  bytes: Uint8Array,
): { width: number; height: number; depth: number } | null {
  const parsed = parse(bytes);
  if (!parsed) return null;
  const gltf = parsed.json as Gltf;
  const nodes = gltf.nodes ?? [];
  const roots = gltf.scenes?.[gltf.scene ?? 0]?.nodes ?? [];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const visit = (index: number, parent: Matrix, depth: number) => {
    const node = nodes[index];
    // The depth cap also stops a file whose nodes point back at each other.
    if (!node || depth > 64) return;
    const world = multiply(parent, localMatrix(node));
    for (const primitive of gltf.meshes?.[node.mesh ?? -1]?.primitives ?? []) {
      const accessor = gltf.accessors?.[primitive.attributes?.POSITION ?? -1];
      if (accessor?.min?.length !== 3 || accessor.max?.length !== 3) continue;
      for (let corner = 0; corner < 8; corner++) {
        const point = [0, 1, 2].map((axis) =>
          (corner >> axis) & 1 ? (accessor.max?.[axis] ?? 0) : (accessor.min?.[axis] ?? 0),
        );
        for (let axis = 0; axis < 3; axis++) {
          const value =
            (world[axis] ?? 0) * (point[0] ?? 0) +
            (world[4 + axis] ?? 0) * (point[1] ?? 0) +
            (world[8 + axis] ?? 0) * (point[2] ?? 0) +
            (world[12 + axis] ?? 0);
          min[axis] = Math.min(min[axis] ?? Infinity, value);
          max[axis] = Math.max(max[axis] ?? -Infinity, value);
        }
      }
    }
    for (const child of node.children ?? []) visit(child, world, depth + 1);
  };
  for (const root of roots) visit(root, IDENTITY, 0);
  const [width, height, depth] = [0, 1, 2].map((axis) => (max[axis] ?? 0) - (min[axis] ?? 0));
  if (![width, height, depth].every((side) => Number.isFinite(side) && (side ?? 0) >= 0)) {
    return null;
  }
  if (!width && !height && !depth) return null;
  return { width: width ?? 0, height: height ?? 0, depth: depth ?? 0 };
}

// One scale for the whole piece, so it keeps its shape: from the height when the size has one,
// else from the larger of the sides it has against the model's larger floor side (the model's
// width and depth axes are not guaranteed to match the store's, so those two are not paired).
export function realSizeScale(
  size: RealSize,
  model: { width: number; height: number; depth: number },
): number | null {
  const metres = (cm: number) => cm / 100;
  let scale: number | null = null;
  if (size.heightCm && model.height > 0) {
    scale = metres(size.heightCm) / model.height;
  } else {
    const floor = Math.max(size.widthCm ?? 0, size.depthCm ?? 0);
    const modelFloor = Math.max(model.width, model.depth);
    if (floor > 0 && modelFloor > 0) scale = metres(floor) / modelFloor;
  }
  return scale !== null && Number.isFinite(scale) && scale > 0 ? scale : null;
}

// A new GLB at its real size: the scene's nodes move under one new node that carries the scale.
// The geometry and textures are not touched. Returns the same bytes when the size cannot be
// applied, so a caller can always serve the result.
export function applyRealSize(bytes: Uint8Array, size: RealSize): Uint8Array {
  const model = measureGlb(bytes);
  const scale = model ? realSizeScale(size, model) : null;
  const parsed = parse(bytes);
  if (!parsed || scale === null) return bytes;
  const gltf = parsed.json as Gltf;
  const sceneIndex = gltf.scene ?? 0;
  const scene = gltf.scenes?.[sceneIndex];
  if (!scene?.nodes || !gltf.nodes) return bytes;
  gltf.nodes.push({ children: scene.nodes, scale: [scale, scale, scale] });
  scene.nodes = [gltf.nodes.length - 1];
  return repack(bytes, parsed);
}
