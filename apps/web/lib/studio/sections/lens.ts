// The sign-in stage. One element is on screen in four readings at once, and three amorphous
// contours around the pointer decide which one each pixel shows: the mesh far away, then the
// collider, then the surface normals, and the textured render under the pointer itself.

import * as THREE from 'three';
import { itemOf } from '../catalog';
import { part, parts } from '../dom';
import { getModel } from '../engine/assets';
import { getStage, prefersReducedMotion, View } from '../engine/stage';
import {
  addFloor,
  addStudioLights,
  fitItem,
  frame,
  INK,
  makeBeauty,
  makeCollider,
  makeWire,
} from '../engine/studio';
import type { Scope } from '../scope';

// ─────────── the lens field ───────────
// Contour radii, innermost first, in stage units (the short side of the stage is 1).
const RADII = [0.17, 0.27, 0.42] as const;
// How far each contour swells in and out, as a share of its radius, and how many swells fit
// around it. Small enough that the contours never cross each other.
const SWELL = [0.2, 0.17, 0.2] as const;
const LOBES = 2.8;

const glslVec3 = (values: readonly number[]) =>
  `vec3(${values.map((value) => value.toFixed(4)).join(', ')})`;

// The field is written twice: here for every material on the stage, and in `wave` and `reach`
// below for the labels that ride the contours. Keep the two in step.
const FIELD = /* glsl */ `
uniform vec2 uLensAt; // lens centre, in framebuffer pixels
uniform float uLensUnit; // framebuffer pixels per stage unit
uniform float uLensTime;
uniform vec3 uLensRadii;
uniform float uLensGrain; // width of the dithered edge, in stage units
uniform float uLensLine; // half the contour line, in framebuffer pixels

const vec3 LENS_SWELL = ${glslVec3(SWELL)};
const vec3 LENS_WAVES = ${glslVec3(RADII.map((radius) => LOBES / radius))};

float lensWave(vec2 q, float s) {
	q += 0.35 * vec2(sin(q.y * 1.2 + s + uLensTime * 0.31), cos(q.x * 1.1 - s * 1.3 - uLensTime * 0.27));
	return 0.55 * sin(q.x + s * 1.7 + uLensTime * 0.23) * cos(q.y * 0.87 - s * 0.9 + uLensTime * 0.19)
		+ 0.3 * sin(q.x * 1.7 - q.y * 1.4 + s * 2.3 - uLensTime * 0.17)
		+ 0.15 * cos(q.x * 0.6 + q.y * 2.0 + s + uLensTime * 0.29);
}

// Signed distance to contour i, negative inside it. The outline is pushed in and out by a
// field anchored to the screen, so it changes shape as the lens travels.
float lensEdge(int i) {
	vec2 q = gl_FragCoord.xy / uLensUnit;
	float d = length(gl_FragCoord.xy - uLensAt) / uLensUnit;
	return d - uLensRadii[i] * (1.0 + LENS_SWELL[i] * lensWave(q * LENS_WAVES[i], float(i) * 2.1));
}
`;

const BAND = /* glsl */ `
// How many contours enclose this pixel: 3 under the pointer, 0 far from it. Interleaved
// gradient noise makes one reading dissolve into the next over a few pixels.
float lensBand() {
	float grain = (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) * uLensGrain;
	return step(lensEdge(0) + grain, 0.0) + step(lensEdge(1) + grain, 0.0) + step(lensEdge(2) + grain, 0.0);
}
`;

// Normals at full strength would outshine the render they surround.
const SOFTEN = /* glsl */ `
	gl_FragColor.rgb = mix(vec3(dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722))), gl_FragColor.rgb, 0.8) * 0.94;`;

function wave(x: number, y: number, s: number, t: number) {
  const qx = x + 0.35 * Math.sin(y * 1.2 + s + t * 0.31);
  const qy = y + 0.35 * Math.cos(x * 1.1 - s * 1.3 - t * 0.27);
  return (
    0.55 * Math.sin(qx + s * 1.7 + t * 0.23) * Math.cos(qy * 0.87 - s * 0.9 + t * 0.19) +
    0.3 * Math.sin(qx * 1.7 - qy * 1.4 + s * 2.3 - t * 0.17) +
    0.15 * Math.cos(qx * 0.6 + qy * 2.0 + s + t * 0.29)
  );
}

// How far contour `i` is from the lens centre along a direction. Everything in stage units.
function reach(
  i: number,
  centre: { x: number; y: number },
  direction: { x: number; y: number },
  radius: number,
  t: number,
) {
  const waves = LOBES / RADII[i];
  let distance = radius;
  for (let step = 0; step < 6; step++) {
    const x = (centre.x + distance * direction.x) * waves;
    const y = (centre.y + distance * direction.y) * waves;
    const edge = radius * (1 + SWELL[i] * wave(x, y, i * 2.1, t));
    distance += (edge - distance) * 0.6;
  }
  return distance;
}

function createLens() {
  const uniforms = {
    uLensAt: { value: new THREE.Vector2() },
    uLensUnit: { value: 1 },
    uLensTime: { value: 0 },
    uLensRadii: { value: new THREE.Vector3() },
    uLensGrain: { value: 0 },
    uLensLine: { value: 1 },
  };

  // Keeps a material's pixels only where between `min` and `max` contours enclose them.
  // `finish` is GLSL that runs last, on the colour the material wrote.
  const confine = (material: THREE.Material, min: number, max: number, finish = '') => {
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader = shader.fragmentShader
        .replace(
          /void\s+main\s*\(\s*\)\s*\{/,
          `${FIELD}${BAND}
void main() {
	float lensCount = lensBand();
	if (lensCount < ${min - 0.5} || lensCount > ${max + 0.5}) discard;
`,
        )
        .replace(/\}\s*$/, `${finish}\n}`);
    };
    material.customProgramCacheKey = () => `lens:${min}:${max}:${finish}`;
  };

  // The three outlines, and a faint lift of the background inside each.
  const contours = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uLensInk: { value: new THREE.Color(INK.bone) } },
      vertexShader: 'void main() {\n\tgl_Position = vec4(position.xy, 0.0, 1.0);\n}',
      fragmentShader: `${FIELD}
uniform vec3 uLensInk;
const vec3 LENS_LINE = vec3(0.6, 0.42, 0.28);

void main() {
	float alpha = 0.0;
	float depth = 0.0;
	for (int i = 0; i < 3; i++) {
		float edge = lensEdge(i);
		float px = max(fwidth(edge), 0.00001);
		float line = 1.0 - smoothstep((uLensLine - 0.5) * px, (uLensLine + 0.5) * px, abs(edge));
		alpha = max(alpha, LENS_LINE[i] * line);
		depth += 1.0 - smoothstep(-px, px, edge);
	}
	gl_FragColor = vec4(uLensInk, max(alpha, 0.012 * depth));
	#include <colorspace_fragment>
}`,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  contours.frustumCulled = false;
  contours.renderOrder = 50;

  return { uniforms, confine, contours };
}

type Drawable = THREE.Object3D & { material?: THREE.Material | THREE.Material[] };

const eachMaterial = (root: THREE.Object3D, visit: (material: THREE.Material) => void) =>
  root.traverse((node) => {
    const { material } = node as Drawable;
    for (const entry of material ? [material].flat() : []) visit(entry);
  });

const repaint = (root: THREE.Object3D, material: THREE.Material) =>
  root.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) (node as THREE.Mesh).material = material;
  });

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
// The shortest way round from one angle to another.
const turn = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

// The labels sit along one ray from the lens, by default up and to the right of the pointer.
const TAG_ANGLE = 0.6;
// How long the lens waits beside a resting pointer before it drifts back to the element.
const REST_MS = 4000;

export type LensContext = { scope: Scope; id: string };

export async function initLens(root: HTMLElement, { scope, id }: LensContext) {
  const item = itemOf(id);
  const size = fitItem(item);
  const still = prefersReducedMotion();
  const host = part(root, 'view');
  // In the page from the pointer outwards: texture, normals, physics, mesh.
  const tags = parts(root, 'tag');

  const view = new View(getStage(), host, { fov: 24, dpr: 1.75 });
  scope.add(() => view.dispose());
  const lens = createLens();

  addStudioLights(view.scene, { shadows: true });
  // The floor only lights up inside the lens; the mesh is drawn on the bare panel.
  const floor = addFloor(view.scene, {
    receiveShadow: true,
    pool: 0.1,
    footprint: size.footprint,
  });
  eachMaterial(floor.group, (material) => lens.confine(material, 1, 3));

  const [beauty, normals, body, wire, collider] = await Promise.all([
    makeBeauty(id, { ownMaterials: true, shadows: true }),
    getModel(id),
    getModel(id),
    makeWire(id, { fill: INK.graphite }),
    makeCollider(id),
  ]);
  if (!scope.alive) return;
  repaint(normals, new THREE.MeshNormalMaterial());
  repaint(body, new THREE.MeshStandardMaterial({ color: 0x66666c, roughness: 0.9, metalness: 0 }));
  const physics = new THREE.Group();
  physics.add(body, collider.object);

  // One reading per band, counted in contours crossed on the way to the pointer.
  const pivot = new THREE.Group();
  pivot.scale.setScalar(size.s);
  [wire.object, physics, normals, beauty].forEach((reading, band) => {
    const finish = reading === normals ? SOFTEN : '';
    eachMaterial(reading, (material) => lens.confine(material, band, band, finish));
    pivot.add(reading);
  });
  view.scene.add(pivot, lens.contours);

  const stage = { w: 1, h: 1 };
  const look = { yaw: -0.55, elev: 0.2 };
  const place = () => frame(view, { cy: size.cy, margin: 1.4, elev: look.elev, shiftY: 0.02 });
  view.onResize = () => {
    stage.w = host.clientWidth || 1;
    stage.h = host.clientHeight || 1;
    place();
  };
  view.onResize(view);

  // ——— the pointer ———
  const pointer = { x: 0, y: 0, seen: false, at: 0 };
  const follow = (event: Event) => {
    const { clientX, clientY, pointerType, target } = event as PointerEvent;
    // A finger only moves the lens while it is on the stage; the rest of the page scrolls.
    if (pointerType === 'touch' && !root.contains(target as Node)) return;
    const rect = host.getBoundingClientRect();
    pointer.x = clientX - rect.left;
    pointer.y = clientY - rect.top;
    pointer.seen = true;
    pointer.at = performance.now();
    if (pointer.x >= 0 && pointer.x <= rect.width && pointer.y >= 0 && pointer.y <= rect.height) {
      root.classList.add('is-used');
    }
    if (still) view.invalidate();
  };
  const release = (event: Event) => {
    if ((event as PointerEvent).pointerType !== 'mouse') pointer.seen = false;
  };
  scope.on(window, 'pointermove', follow);
  scope.on(window, 'pointerdown', follow);
  scope.on(window, 'pointerup', release);
  scope.on(window, 'pointercancel', release);
  scope.on(document.documentElement, 'pointerleave', () => {
    pointer.seen = false;
  });

  const at = { x: 0, y: 0, placed: false };
  let opening = still ? 1 : 0;
  let tagAngle = TAG_ANGLE;

  view.tick = (dt, time) => {
    const { w, h } = stage;
    const scale = view.pw / w; // framebuffer pixels per CSS pixel
    const unit = Math.min(view.pw, view.ph);

    // With no pointer nearby the lens drifts over the element, so the page is never all mesh.
    const inside = pointer.x >= 0 && pointer.x <= w && pointer.y >= 0 && pointer.y <= h;
    const following = pointer.seen && (inside || performance.now() - pointer.at < REST_MS);
    const reachPx = unit / scale;
    const goal = following
      ? pointer
      : still
        ? { x: w * 0.56, y: h * 0.44 }
        : {
            x: w * 0.5 + reachPx * 0.2 * Math.cos(time * 0.38),
            y: h * 0.5 + reachPx * 0.13 * Math.sin(time * 0.53),
          };
    const pull = still || !at.placed ? 1 : 1 - Math.exp(-dt * 7);
    at.x += (goal.x - at.x) * pull;
    at.y += (goal.y - at.y) * pull;
    at.placed = true;

    // The element turns a little towards the lens.
    if (!still) {
      const ease = 1 - Math.exp(-dt * 3);
      look.yaw += (-0.55 + (clamp(at.x / w, -0.25, 1.25) - 0.5) * 0.7 - look.yaw) * ease;
      look.elev += (0.2 + (clamp(at.y / h, -0.25, 1.25) - 0.5) * 0.14 - look.elev) * ease;
      opening += (1 - opening) * (1 - Math.exp(-dt * 3.2));
    }
    pivot.rotation.y = look.yaw;
    place();

    const t = still ? 0 : time;
    const breath = still ? 1 : 1 + 0.035 * Math.sin(time * 0.9);
    const radii = RADII.map((radius) => radius * opening * breath);
    const { uniforms } = lens;
    uniforms.uLensAt.value.set(at.x * scale, (h - at.y) * scale);
    uniforms.uLensUnit.value = unit;
    uniforms.uLensTime.value = t;
    uniforms.uLensRadii.value.set(radii[0], radii[1], radii[2]);
    uniforms.uLensGrain.value = (5 * scale) / unit;
    uniforms.uLensLine.value = 0.42 * scale;

    // Labels sit mid-band along one ray from the lens. It points up and to the right while
    // there is room for them there, and swings to the other side near those edges of the stage.
    const centre = { x: (at.x * scale) / unit, y: ((h - at.y) * scale) / unit };
    const side = at.x < w * 0.62 ? 1 : -1;
    const rise = at.y > h * 0.36 ? 1 : -1;
    const wanted = Math.atan2(rise * Math.sin(TAG_ANGLE), side * Math.cos(TAG_ANGLE));
    tagAngle += turn(wanted - tagAngle) * (still ? 1 : 1 - Math.exp(-dt * 5));
    const ray = { x: Math.cos(tagAngle), y: Math.sin(tagAngle) };
    const edge = radii.map((radius, i) => reach(i, centre, ray, radius, t));
    const spots = [edge[0] * 0.8, (edge[0] + edge[1]) / 2, (edge[1] + edge[2]) / 2, edge[2] + 0.05];
    tags.forEach((tag, i) => {
      const x = ((centre.x + spots[i] * ray.x) * unit) / scale;
      const y = h - ((centre.y + spots[i] * ray.y) * unit) / scale;
      tag.style.setProperty('--x', `${x.toFixed(1)}px`);
      tag.style.setProperty('--y', `${y.toFixed(1)}px`);
    });
  };

  view.paused = still;
  view.start();
  root.classList.add('is-ready');
  scope.add(() => root.classList.remove('is-ready', 'is-used'));
}
