// The studio: lights, floor, framing and "passes" (the different readings of one mesh).

import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { type CatalogItem, itemOf } from '../catalog';
import { getHullPoints, getModel, getWireGeometry, standard } from './assets';
import { keep } from './resources';
import type { View } from './stage';

export const INK = {
  carbon: 0x0a0a0b,
  graphite: 0x131315,
  slate: 0x1c1c1f,
  bone: 0xecebe7,
  ash: 0x8a8a8f,
  x: 0xf2555a,
  y: 0x8bd450,
  z: 0x4d8dff,
} as const;

// ——— lights ———
export function addStudioLights(
  scene: THREE.Scene,
  { shadows = false, key = 1.55, rim = 2.2, fill = 0.22, reach = 1.5 } = {},
) {
  const keyLight = new THREE.DirectionalLight(0xfff1e0, key);
  keyLight.position.set(2.4, 3.6, 2.8);
  const rimLight = new THREE.DirectionalLight(0xc9dcff, rim);
  rimLight.position.set(-3, 2.4, -3.2);
  const fillLight = new THREE.DirectionalLight(0xffffff, fill);
  fillLight.position.set(-2.6, 0.8, 2.6);
  if (shadows) {
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    Object.assign(keyLight.shadow.camera, {
      left: -reach,
      right: reach,
      top: reach,
      bottom: -reach,
      near: 0.5,
      far: 12,
    });
    keyLight.shadow.bias = -0.0006;
    keyLight.shadow.normalBias = 0.02;
    keyLight.shadow.radius = 5;
  }
  scene.add(keyLight, rimLight, fillLight);
  return { keyLight, rimLight, fillLight };
}

// ——— studio floor ———
// `data` marks a texture that carries values (an alpha map) rather than colour.
export function radialTexture(stops: [number, string][], { size = 256, data = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [offset, color] of stops) gradient.addColorStop(offset, color);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  return texture;
}

let poolTexture: THREE.Texture | null = null;
let blobTexture: THREE.Texture | null = null;

export type Floor = { group: THREE.Group; blob: THREE.Mesh | null };

export function addFloor(
  scene: THREE.Scene,
  {
    pool = 0.085,
    contact = 0.6,
    footprint = [1, 1] as [number, number],
    poolRadius = 2.6,
    receiveShadow = false,
  } = {},
): Floor {
  poolTexture ??= radialTexture([
    [0, 'rgba(255,255,255,1)'],
    [0.35, 'rgba(255,255,255,0.45)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  blobTexture ??= radialTexture([
    [0, 'rgba(0,0,0,1)'],
    [0.45, 'rgba(0,0,0,0.55)'],
    [1, 'rgba(0,0,0,0)'],
  ]);
  const group = new THREE.Group();
  const plane = new THREE.PlaneGeometry(1, 1);
  const decal = (map: THREE.Texture, opacity: number) =>
    new THREE.MeshBasicMaterial({
      map,
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
    });
  if (pool > 0) {
    const mesh = new THREE.Mesh(plane, decal(poolTexture, pool));
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.setScalar(poolRadius * 2);
    mesh.position.y = -0.002;
    mesh.renderOrder = -2;
    group.add(mesh);
  }
  let blob: THREE.Mesh | null = null;
  if (contact > 0) {
    blob = new THREE.Mesh(plane, decal(blobTexture, contact));
    blob.rotation.x = -Math.PI / 2;
    blob.scale.set(footprint[0] * 1.55, footprint[1] * 1.55, 1);
    blob.position.y = -0.001;
    blob.renderOrder = -1;
    group.add(blob);
  }
  if (receiveShadow) {
    const catcher = new THREE.Mesh(
      plane,
      new THREE.ShadowMaterial({ opacity: 0.5, depthWrite: false }),
    );
    catcher.rotation.x = -Math.PI / 2;
    catcher.scale.setScalar(8);
    catcher.receiveShadow = true;
    group.add(catcher);
  }
  scene.add(group);
  return { group, blob };
}

// ——— scale and framing ———
export type Fit = {
  // Scale that brings the element's bounding sphere to radius 1.
  s: number;
  cy: number;
  footprint: [number, number];
  h: number;
};

export function fitItem(item: CatalogItem): Fit {
  const [w, h, d] = item.dims;
  const s = 1 / (0.5 * Math.hypot(w, h, d));
  return { s, cy: (h / 2) * s, footprint: [w * s, d * s], h: h * s };
}

// Wraps a model-space object in a group scaled to radius 1.
export function normalized(object: THREE.Object3D, item: CatalogItem) {
  const group = new THREE.Group();
  group.scale.setScalar(fitItem(item).s);
  group.add(object);
  return group;
}

export type FrameOptions = {
  cy?: number;
  radius?: number;
  margin?: number;
  elev?: number;
  azim?: number;
  // Fractions of the view: move the picture without changing the perspective.
  shiftX?: number;
  shiftY?: number;
  tightDepth?: boolean;
};

// Places the camera so a sphere of `radius` centred at (0, cy, 0) fits in the view.
export function frame(
  view: View,
  {
    cy = 0,
    radius = 1,
    margin = 1.1,
    elev = 0.22,
    azim = 0,
    shiftX = 0,
    shiftY = 0,
    tightDepth = false,
  }: FrameOptions = {},
) {
  const camera = view.camera;
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const dist = (radius * margin) / Math.sin(Math.min(vfov, hfov) / 2);
  camera.position.set(
    Math.sin(azim) * Math.cos(elev) * dist,
    cy + Math.sin(elev) * dist,
    Math.cos(azim) * Math.cos(elev) * dist,
  );
  camera.lookAt(0, cy, 0);
  if (shiftX || shiftY) {
    camera.setViewOffset(view.pw, view.ph, -shiftX * view.pw, shiftY * view.ph, view.pw, view.ph);
  } else {
    camera.clearViewOffset();
  }
  camera.near = tightDepth ? dist - radius * 1.08 : Math.max(0.05, dist * 0.18);
  camera.far = tightDepth ? dist + radius * 1.12 : dist + radius * 6;
  camera.updateProjectionMatrix();
  return dist;
}

// ——— passes ———
const shaded = {
  normal: keep(new THREE.MeshNormalMaterial()),
  depth: keep(new THREE.MeshDepthMaterial()),
  clay: keep(new THREE.MeshStandardMaterial({ color: 0xc9c8c3, roughness: 0.82, metalness: 0 })),
};

export type ShadedPass = keyof typeof shaded | 'albedo';

const eachMesh = (root: THREE.Object3D, visit: (mesh: THREE.Mesh) => void) =>
  root.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) visit(node as THREE.Mesh);
  });

// The textured model, in model space (metres, origin at the centre of the base).
export async function makeBeauty(
  id: string,
  options: { lod?: 0 | 1 | 2; hd?: boolean; ownMaterials?: boolean; shadows?: boolean } = {},
) {
  const model = await getModel(id, options);
  if (options.shadows) {
    eachMesh(model, (mesh) => {
      mesh.castShadow = true;
    });
  }
  return model;
}

// The same mesh drawn with a debug material: clay, surface normals, depth or flat base colour.
export async function makeShaded(id: string, pass: ShadedPass, options: { lod?: 0 | 1 | 2 } = {}) {
  const model = await getModel(id, options);
  eachMesh(model, (mesh) => {
    if (pass === 'albedo') {
      const source = standard(mesh);
      mesh.material = new THREE.MeshBasicMaterial({
        map: source.map,
        color: source.map ? 0xffffff : source.color,
      });
    } else {
      mesh.material = shaded[pass];
    }
  });
  return model;
}

export type WirePass = {
  object: THREE.Group;
  fill: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  lines: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
};

// Hidden-line wireframe: a fill in the background colour with the edges drawn over it.
export async function makeWire(
  id: string,
  options: { fill?: number; color?: number; opacity?: number } = {},
): Promise<WirePass> {
  const geometry = await getWireGeometry(id);
  const fill = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: options.fill ?? INK.graphite,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
      toneMapped: false,
    }),
  );
  const lines = new THREE.LineSegments(
    new THREE.WireframeGeometry(geometry),
    new THREE.LineBasicMaterial({
      color: options.color ?? INK.bone,
      transparent: true,
      opacity: options.opacity ?? 0.62,
      toneMapped: false,
    }),
  );
  const object = new THREE.Group();
  object.add(fill, lines);
  return { object, fill, lines };
}

export type ColliderPass = {
  object: THREE.Group;
  edges: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  verts: number;
};

const colliderLine = (color: number, opacity: number) =>
  new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: false,
    toneMapped: false,
  });

// Convex hull of the element: translucent faces plus its edges.
export async function makeHull(
  id: string,
  options: { color?: number; opacity?: number; faceOpacity?: number } = {},
): Promise<ColliderPass> {
  const color = options.color ?? INK.y;
  const points = (await getHullPoints(id)).map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const geometry = new ConvexGeometry(points);
  const faces = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: options.faceOpacity ?? 0.07,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 1),
    colliderLine(color, options.opacity ?? 0.9),
  );
  edges.renderOrder = 5;
  const object = new THREE.Group();
  object.add(faces, edges);
  return { object, edges, verts: points.length };
}

// A wire cylinder: two rings and a few ribs, centred on the origin.
export function cylinderWire(radius: number, height: number, { seg = 40, ribs = 8 } = {}) {
  const points: number[] = [];
  for (const y of [-height / 2, height / 2]) {
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const b = ((i + 1) / seg) * Math.PI * 2;
      points.push(Math.cos(a) * radius, y, Math.sin(a) * radius);
      points.push(Math.cos(b) * radius, y, Math.sin(b) * radius);
    }
  }
  for (let i = 0; i < ribs; i++) {
    const a = (i / ribs) * Math.PI * 2;
    points.push(Math.cos(a) * radius, -height / 2, Math.sin(a) * radius);
    points.push(Math.cos(a) * radius, height / 2, Math.sin(a) * radius);
  }
  return new THREE.BufferGeometry().setAttribute(
    'position',
    new THREE.Float32BufferAttribute(points, 3),
  );
}

// The collider the simulation uses for the element (box, cylinder or convex hull).
// `centred` puts the origin at the middle of the bounding box, where the rigid body lives.
export async function makeCollider(
  id: string,
  options: { color?: number; opacity?: number; centred?: boolean } = {},
): Promise<ColliderPass> {
  const item = itemOf(id);
  const [w, h, d] = item.dims;
  const color = options.color ?? INK.y;
  const opacity = options.opacity ?? 0.9;
  let pass: ColliderPass;
  if (item.collider === 'hull') {
    pass = await makeHull(id, { color, opacity });
    if (options.centred) pass.object.position.y = -h / 2;
    return pass;
  }
  const geometry =
    item.collider === 'box'
      ? new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d))
      : cylinderWire(Math.max(w, d) / 2, h);
  const edges = new THREE.LineSegments(geometry, colliderLine(color, opacity));
  edges.renderOrder = 6;
  if (!options.centred) edges.position.y = h / 2;
  const object = new THREE.Group();
  object.add(edges);
  return { object, edges, verts: item.collider === 'box' ? 8 : 48 };
}

// ——— drafting aids ———
// The element's bounding box.
export function boundsBox(
  item: CatalogItem,
  { color = INK.bone as number, opacity = 0.5, dashed = true } = {},
) {
  const [w, h, d] = item.dims;
  const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d));
  const material = dashed
    ? new THREE.LineDashedMaterial({
        color,
        transparent: true,
        opacity,
        dashSize: 0.02,
        gapSize: 0.014,
        toneMapped: false,
      })
    : new THREE.LineBasicMaterial({ color, transparent: true, opacity, toneMapped: false });
  const box = new THREE.LineSegments(geometry, material);
  if (dashed) box.computeLineDistances();
  box.position.y = h / 2;
  return box;
}

// XYZ axis triad (gizmo).
export function axes(length = 0.3) {
  const group = new THREE.Group();
  const axis = (direction: THREE.Vector3, color: number) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      direction.multiplyScalar(length),
    ]);
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color, depthTest: false, toneMapped: false }),
    );
    line.renderOrder = 10;
    return line;
  };
  group.add(
    axis(new THREE.Vector3(1, 0, 0), INK.x),
    axis(new THREE.Vector3(0, 1, 0), INK.y),
    axis(new THREE.Vector3(0, 0, 1), INK.z),
  );
  return group;
}

// A faint floor grid.
export function grid(size = 4, divisions = 16, opacity = 0.07) {
  const helper = new THREE.GridHelper(size, divisions, INK.bone, INK.bone);
  helper.material.transparent = true;
  helper.material.opacity = opacity;
  helper.material.depthWrite = false;
  helper.material.toneMapped = false;
  return helper;
}

const projected = new THREE.Vector3();

// A world point in CSS pixels inside the view.
export function project(view: View, point: THREE.Vector3) {
  projected.copy(point).project(view.camera);
  return {
    x: (projected.x * 0.5 + 0.5) * view.el.clientWidth,
    y: (-projected.y * 0.5 + 0.5) * view.el.clientHeight,
  };
}

// ——— easing ———
export const ease = {
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  out: (t: number) => 1 - (1 - t) ** 3,
  outBack: (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2,
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
};

export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
// 0 → 1 as `t` goes from a to b.
export const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
