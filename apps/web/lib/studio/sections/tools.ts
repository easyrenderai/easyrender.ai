// The live spec sheet: every tile is a real viewport driven by the control that sits on it.

import * as THREE from 'three';
import { itemOf } from '../catalog';
import { part, parts, watchVisible } from '../dom';
import { firstMesh, getModel, getWireGeometry, meshData, standard } from '../engine/assets';
import { getStage, prefersReducedMotion, View } from '../engine/stage';
import {
  addFloor,
  addStudioLights,
  axes,
  boundsBox,
  ease,
  fitItem,
  frame,
  INK,
  lerp,
  makeBeauty,
  makeHull,
  makeShaded,
  normalized,
  project,
  radialTexture,
  seg,
} from '../engine/studio';
import type { Format } from '../format';
import type { Scope } from '../scope';

const DPR = 1.75;

export type ToolsContext = {
  scope: Scope;
  fmt: Format;
  labels: {
    // "{count} vertices" and "{count} triangles", already in the visitor's language.
    vertices: (count: number) => string;
    triangles: (count: number) => string;
  };
};

const setKnob = (knob: HTMLElement, p: number) =>
  knob.parentElement?.style.setProperty('--p', p.toFixed(4));

function tileView(tile: HTMLElement, scope: Scope, options: { envIntensity?: number } = {}) {
  const view = new View(getStage(), part(tile, 'view'), { dpr: DPR, ...options });
  scope.add(() => view.dispose());
  return view;
}

// ─────────── Topology: levels of detail ───────────
async function topology(tile: HTMLElement, { scope, fmt }: ToolsContext) {
  const id = 'sofa';
  const item = itemOf(id);
  const still = prefersReducedMotion();
  const view = tileView(tile, scope);
  addStudioLights(view.scene);
  const size = fitItem(item);
  const pivot = new THREE.Group();
  pivot.scale.setScalar(size.s);
  view.scene.add(pivot);
  view.onResize = () => frame(view, { cy: size.cy, margin: 1.22, elev: 0.3, shiftY: 0.1 });
  view.onResize(view);

  const lods = await Promise.all(
    ([0, 1, 2] as const).map(async (lod) => {
      const model = await getModel(id, { lod, ownMaterials: true });
      const { mesh, matrix } = meshData(model);
      const material = standard(mesh);
      material.polygonOffset = true;
      material.polygonOffsetFactor = 1;
      material.polygonOffsetUnits = 1;
      const lines = new THREE.LineSegments(
        new THREE.WireframeGeometry(mesh.geometry),
        new THREE.LineBasicMaterial({
          color: INK.bone,
          transparent: true,
          opacity: [0.16, 0.34, 0.55][lod],
          toneMapped: false,
        }),
      );
      lines.applyMatrix4(matrix);
      const group = new THREE.Group();
      group.add(model, lines);
      group.visible = lod === 0;
      return group;
    }),
  );
  if (!scope.alive) return;
  pivot.add(...lods);
  const tris = item.lods.map((lod) => lod.tris);
  const value = part(tile, 'value');
  const knob = part(tile, 'knob');

  let t = 0;
  let shown = -1;
  view.tick = (dt) => {
    t = (t + dt) % 8.4;
    const p = still
      ? 0.5
      : 0.5 * ease.inOut(seg(t, 1.0, 2.2)) +
        0.5 * ease.inOut(seg(t, 3.4, 4.6)) -
        ease.inOut(seg(t, 6.4, 7.8));
    const lod = p < 0.25 ? 0 : p < 0.75 ? 1 : 2;
    if (lod !== shown) {
      shown = lod;
      lods.forEach((group, i) => {
        group.visible = i === lod;
      });
    }
    const count = p < 0.5 ? lerp(tris[0], tris[1], p * 2) : lerp(tris[1], tris[2], p * 2 - 1);
    value.textContent = fmt.int(Math.round(count / 10) * 10);
    setKnob(knob, p);
    pivot.rotation.y = -0.5 + (still ? 0 : Math.sin((t * Math.PI * 2) / 8.4) * 0.22);
  };
  view.paused = still;
  view.start();
}

// ─────────── PBR material ───────────
async function material(tile: HTMLElement, { scope, fmt }: ToolsContext) {
  const id = 'vase';
  const item = itemOf(id);
  const still = prefersReducedMotion();
  const view = tileView(tile, scope, { envIntensity: 0.85 });
  addStudioLights(view.scene, { key: 1.3 });
  const model = await makeBeauty(id, { ownMaterials: true });
  if (!scope.alive) return;
  const object = normalized(model, item);
  const size = fitItem(item);
  view.scene.add(object);
  addFloor(view.scene, { footprint: size.footprint, pool: 0.07 });
  view.onResize = () => frame(view, { cy: size.cy, margin: 1.5, elev: 0.16, shiftY: 0.12 });
  view.onResize(view);
  const surface = standard(firstMesh(model));
  const base = { roughness: surface.roughness, metalness: surface.metalness };

  const knobs = { rough: part(tile, 'knob-rough'), metal: part(tile, 'knob-metal') };
  const values = { rough: part(tile, 'value-rough'), metal: part(tile, 'value-metal') };
  const cursor = part(tile, 'cursor');
  let held: keyof typeof knobs = 'rough';

  let t = 0;
  view.tick = (dt) => {
    t = (t + dt) % 9;
    let roughness = base.roughness;
    let metalness = base.metalness;
    if (!still) {
      roughness =
        lerp(base.roughness, 0.06, ease.inOut(seg(t, 0.8, 2.3))) +
        (base.roughness - 0.06) * ease.inOut(seg(t, 7.2, 8.4));
      metalness = ease.inOut(seg(t, 3.0, 4.5)) - ease.inOut(seg(t, 5.9, 7.0));
      const wanted = t > 2.6 && t < 7.1 ? 'metal' : 'rough';
      if (wanted !== held) {
        held = wanted;
        knobs[held].append(cursor);
      }
    }
    surface.roughness = roughness;
    surface.metalness = metalness;
    setKnob(knobs.rough, roughness);
    setKnob(knobs.metal, metalness);
    values.rough.textContent = fmt.fixed(roughness);
    values.metal.textContent = fmt.fixed(metalness);
    object.rotation.y = t * 0.25;
  };
  scope.add(() => knobs.rough.append(cursor));
  view.paused = still;
  view.start();
}

// ─────────── Real scale ───────────
async function scale(tile: HTMLElement, { scope, fmt }: ToolsContext) {
  const id = 'bedside-table';
  const item = itemOf(id);
  const [w, h, d] = item.dims;
  const still = prefersReducedMotion();
  const view = tileView(tile, scope);
  addStudioLights(view.scene);
  const beauty = await makeBeauty(id);
  if (!scope.alive) return;
  const group = new THREE.Group();
  const gizmo = axes(Math.min(w, h, d) * 0.42);
  gizmo.position.set(-w / 2, 0, d / 2);
  group.add(beauty, boundsBox(item, { opacity: 0.8 }), gizmo);
  const object = normalized(group, item);
  const size = fitItem(item);
  view.scene.add(object);
  view.onResize = () => frame(view, { cy: size.cy, margin: 1.3, elev: 0.34, shiftY: -0.02 });
  view.onResize(view);

  const labels = [
    { element: part(tile, 'dim-w'), point: new THREE.Vector3(0, 0, d / 2), metres: w },
    { element: part(tile, 'dim-h'), point: new THREE.Vector3(w / 2, h / 2, d / 2), metres: h },
    { element: part(tile, 'dim-d'), point: new THREE.Vector3(w / 2, 0, 0), metres: d },
  ];
  for (const label of labels) label.element.textContent = `${fmt.cm(label.metres)} cm`;
  const world = new THREE.Vector3();

  let t = 0;
  view.tick = (dt) => {
    t += dt;
    object.rotation.y = -0.62 + (still ? 0 : Math.sin(t * 0.45) * 0.3);
    object.updateMatrixWorld(true);
    for (const label of labels) {
      const at = project(view, group.localToWorld(world.copy(label.point)));
      label.element.style.transform = `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px)`;
    }
  };
  view.paused = still;
  view.start();
}

// ─────────── Collider ───────────
async function collider(tile: HTMLElement, { scope, labels }: ToolsContext) {
  const id = 'swivel-chair';
  const item = itemOf(id);
  const still = prefersReducedMotion();
  const view = tileView(tile, scope);
  addStudioLights(view.scene, { key: 1.2 });
  const [clay, hull, wireGeometry] = await Promise.all([
    makeShaded(id, 'clay'),
    makeHull(id, { faceOpacity: 0.06 }),
    getWireGeometry(id),
  ]);
  if (!scope.alive) return;
  const box = boundsBox(item, { color: INK.y, opacity: 0.95, dashed: false });
  const mesh = new THREE.LineSegments(
    new THREE.WireframeGeometry(wireGeometry),
    new THREE.LineBasicMaterial({
      color: INK.y,
      transparent: true,
      opacity: 0.6,
      depthTest: false,
      toneMapped: false,
    }),
  );
  const group = new THREE.Group();
  group.add(clay, box, hull.object, mesh);
  const object = normalized(group, item);
  const size = fitItem(item);
  view.scene.add(object);
  addFloor(view.scene, { footprint: size.footprint, pool: 0.06 });
  view.onResize = () => frame(view, { cy: size.cy, margin: 1.36, elev: 0.26, shiftY: 0.07 });
  view.onResize(view);

  const modes = [
    { key: 'box', object: box as THREE.Object3D, text: labels.vertices(8) },
    { key: 'hull', object: hull.object, text: labels.vertices(hull.verts) },
    { key: 'mesh', object: mesh, text: labels.triangles(item.wireTris) },
  ];
  const control = part(tile, 'segments');
  const cursor = part(tile, 'cursor');
  const pill = part(tile, 'value');
  const options = parts(control, 'option');
  const point = (i: number) => {
    const option = options[i];
    const x = option.offsetLeft + option.offsetWidth * 0.55;
    const y = option.offsetTop + option.offsetHeight * 0.55;
    cursor.style.transform = `translate(${x}px, ${y}px)`;
  };
  let current = -1;
  const apply = (i: number) => {
    current = i;
    modes.forEach((mode, j) => {
      mode.object.visible = j === i;
      options[j].classList.toggle('is-on', j === i);
    });
    pill.textContent = modes[i].text;
  };
  apply(1);
  point(1);

  let t = 0;
  let aimed = 1;
  view.tick = (dt) => {
    t += dt;
    object.rotation.y = -0.55 + (still ? 0 : t * 0.2);
    if (still) return;
    const wanted = (Math.floor(t / 2.8) + 1) % 3;
    const upcoming = (wanted + 1) % 3;
    if (wanted !== current) apply(wanted);
    if (t % 2.8 > 1.9 && aimed !== upcoming) {
      aimed = upcoming;
      point(upcoming);
    }
  };
  view.paused = still;
  view.start();
}

// ─────────── Project light ───────────
// Colour temperature (Kelvin) to RGB, close enough for a lamp.
function kelvin(k: number) {
  const t = k / 100;
  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const g =
    t <= 66
      ? 99.4708025861 * Math.log(t) - 161.1195681661
      : 288.1221695283 * (t - 60) ** -0.0755148492;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const channel = (x: number) => Math.min(255, Math.max(0, x)) / 255;
  return new THREE.Color().setRGB(channel(r), channel(g), channel(b), THREE.SRGBColorSpace);
}

async function light(tile: HTMLElement, { scope }: ToolsContext) {
  const lampItem = itemOf('lamp');
  const still = prefersReducedMotion();
  const view = tileView(tile, scope, { envIntensity: 0.14 });
  const size = fitItem(lampItem);
  const world = new THREE.Group();
  world.scale.setScalar(size.s);
  view.scene.add(world);

  // The lamp casts no shadow: the source lives inside its shade.
  const [lamp, vase] = await Promise.all([
    makeBeauty('lamp'),
    makeBeauty('vase', { shadows: true }),
  ]);
  if (!scope.alive) return;
  vase.position.set(0.25, 0, 0.13);
  world.add(lamp, vase);

  // The floor fades out with distance instead of ending in a horizon: past the pool of light
  // it turns transparent and the tile shows through. Floor and rim are exact greys because
  // neutral tone mapping exaggerates any tint in the darks.
  const fade = radialTexture(
    [
      [0, '#fff'],
      [0.3, '#fff'],
      [1, '#000'],
    ],
    { data: true },
  );
  scope.add(() => fade.dispose());
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(7, 64),
    new THREE.MeshStandardMaterial({
      color: 0x4c4c4c,
      roughness: 0.9,
      metalness: 0,
      transparent: true,
      depthWrite: false,
      alphaMap: fade,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  view.scene.add(floor);

  const spot = new THREE.SpotLight(0xffffff, 22, 14, 0.86, 0.85, 1.6);
  spot.position.set(0, size.h * 0.7, 0);
  spot.target.position.set(0, 0, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.camera.near = 0.05;
  spot.shadow.camera.far = 8;
  spot.shadow.bias = -0.002;
  spot.shadow.radius = 6;
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 20, 12),
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
  );
  bulb.position.set(0, size.h * 0.71, 0);
  const rim = new THREE.DirectionalLight(0xffffff, 0.3);
  rim.position.set(-3, 2.5, -3);
  view.scene.add(spot, spot.target, bulb, rim);

  view.onResize = () => frame(view, { cy: size.cy * 0.86, margin: 1.5, elev: 0.36, shiftY: 0.09 });
  view.onResize(view);

  const value = part(tile, 'value');
  const knob = part(tile, 'knob');
  let t = 0;
  view.tick = (dt) => {
    t = (t + dt) % 9;
    const p = still ? 0.12 : ease.inOut(seg(t, 0.8, 3.8)) - ease.inOut(seg(t, 5.0, 8.2));
    const k = Math.round(lerp(2200, 6500, p) / 50) * 50;
    const colour = kelvin(k);
    spot.color.copy(colour);
    bulb.material.color.copy(colour);
    value.textContent = `${k} K`;
    setKnob(knob, p);
    world.rotation.y = -0.35 + (still ? 0 : Math.sin((t * Math.PI * 2) / 9) * 0.12);
  };
  view.paused = still;
  view.start();
}

// ─────────── UVs and textures ───────────
async function uv(tile: HTMLElement, { scope, fmt }: ToolsContext) {
  const id = 'crate';
  const canvas = part<HTMLCanvasElement>(tile, 'uv');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const [full, low] = await Promise.all([getModel(id, { lod: 0 }), getModel(id, { lod: 1 })]);
  if (!scope.alive) return;
  const image = standard(firstMesh(full)).map?.image as
    | (CanvasImageSource & { width: number; height: number })
    | undefined;
  const lowMesh = firstMesh(low);
  const coords = lowMesh.geometry.attributes.uv;
  const indices = lowMesh.geometry.index;
  if (!coords || !indices) return;
  const side = canvas.width;
  // Compressed UVs are restored by the texture transform.
  const map = standard(lowMesh).map;
  map?.updateMatrix();
  const e = map ? map.matrix.elements : [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const u = (i: number) => (e[0] * coords.getX(i) + e[3] * coords.getY(i) + e[6]) * side;
  const v = (i: number) => (e[1] * coords.getX(i) + e[4] * coords.getY(i) + e[7]) * side;

  // One path per batch of triangles, so the islands can be drawn in gradually.
  const BATCH = 60;
  const triangles = indices.count / 3;
  const batches: Path2D[] = [];
  for (let start = 0; start < triangles; start += BATCH) {
    const path = new Path2D();
    for (let tri = start; tri < Math.min(triangles, start + BATCH); tri++) {
      const [a, b, c] = [
        indices.getX(tri * 3),
        indices.getX(tri * 3 + 1),
        indices.getX(tri * 3 + 2),
      ];
      path.moveTo(u(a), v(a));
      path.lineTo(u(b), v(b));
      path.lineTo(u(c), v(c));
      path.closePath();
    }
    batches.push(path);
  }
  if (image?.width) {
    part(tile, 'value').textContent =
      `${fmt.int(image.width)} × ${fmt.int(image.height)} px · WebP`;
  }

  const draw = (progress: number) => {
    ctx.fillStyle = '#17171a';
    ctx.fillRect(0, 0, side, side);
    if (image) {
      ctx.globalAlpha = 0.66;
      ctx.drawImage(image, 0, 0, side, side);
      ctx.globalAlpha = 1;
    }
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgba(236,235,231,0.62)';
    const count = Math.round(progress * batches.length);
    for (let i = 0; i < count; i++) ctx.stroke(batches[i]);
  };

  if (prefersReducedMotion()) {
    draw(1);
    return;
  }
  let raf = 0;
  let origin = 0;
  let last = -1;
  const loop = (now: number) => {
    origin ||= now;
    const t = ((now - origin) / 1000) % 9.5;
    const p = ease.inOut(seg(t, 0.4, 4.2)) * (1 - seg(t, 8.9, 9.5));
    const count = Math.round(p * batches.length);
    if (count !== last) {
      last = count;
      draw(p);
    }
    raf = requestAnimationFrame(loop);
  };
  draw(0);
  scope.add(
    watchVisible(tile, (visible) => {
      cancelAnimationFrame(raf);
      raf = visible ? requestAnimationFrame(loop) : 0;
    }),
  );
  scope.add(() => cancelAnimationFrame(raf));
}

// ─────────── Export ───────────
async function exportFormats(tile: HTMLElement, { scope }: ToolsContext) {
  const id = 'espresso';
  const item = itemOf(id);
  const still = prefersReducedMotion();
  const view = tileView(tile, scope, { envIntensity: 0.5 });
  addStudioLights(view.scene);
  const beauty = await makeBeauty(id);
  if (!scope.alive) return;
  const object = normalized(beauty, item);
  const size = fitItem(item);
  view.scene.add(object);
  addFloor(view.scene, { footprint: size.footprint, pool: 0.08 });
  view.onResize = () => frame(view, { cy: size.cy, margin: 1.62, elev: 0.2, shiftY: 0.2 });
  view.onResize(view);

  const rows = parts(tile, 'file');
  let t = 0;
  let done = -1;
  view.tick = (dt) => {
    t = (t + dt) % 7.6;
    object.rotation.y = 0.5 + t * 0.22;
    const count = still
      ? rows.length
      : t > 6.9
        ? 0
        : Math.min(rows.length, Math.floor((t - 0.6) / 0.75) + 1);
    if (count !== done) {
      done = count;
      rows.forEach((row, i) => {
        row.classList.toggle('is-done', i < count);
      });
    }
  };
  view.paused = still;
  view.start();
}

const TILES = { topology, material, scale, collider, light, uv, export: exportFormats };

export type ToolName = keyof typeof TILES;

export function initTool(name: ToolName, tile: HTMLElement, context: ToolsContext) {
  return TILES[name](tile, context);
}
