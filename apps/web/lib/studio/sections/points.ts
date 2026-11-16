// A hub piece drawn as a cloud of points sampled from its surface and coloured from its own
// texture. The points part around the pointer and the piece leans towards it.

import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { itemOf } from '../catalog';
import { part } from '../dom';
import { getModel, meshData, standard } from '../engine/assets';
import { getStage, prefersReducedMotion, View } from '../engine/stage';
import { fit, frame } from '../engine/studio';
import type { Scope } from '../scope';

const ITEM = 'sneaker';
const SPIN = 0.12; // rad/s

const VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSeed;
  uniform vec3 uRayOrigin;
  uniform vec3 uRayDir;
  uniform float uForce;
  uniform float uIntro;
  uniform float uTime;
  uniform float uSize;
  varying vec3 vColor;
  varying float vLift;

  void main() {
    vec3 p = position;

    // Distance from the point to the pointer's ray, in the piece's own space.
    vec3 toPoint = p - uRayOrigin;
    vec3 away = toPoint - uRayDir * dot(toPoint, uRayDir);
    float lift = smoothstep(0.5, 0.0, length(away)) * uForce;
    p += normalize(away + vec3(0.0001)) * lift * (0.1 + 0.22 * aSeed);

    // A little life when nothing is touching it.
    p += normalize(position + vec3(0.0001)) * sin(uTime * 0.9 + aSeed * 40.0) * 0.004;

    // The cloud gathers from a loose shell on the way in.
    vec3 loose = position * (1.6 + aSeed * 1.4) + vec3(0.0, (aSeed - 0.5) * 0.8, 0.0);
    p = mix(loose, p, uIntro);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.65 + 0.7 * aSeed) * (1.0 + lift * 1.6) / -mv.z;
    vColor = aColor;
    vLift = lift;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uIntro;
  uniform vec3 uBone;
  varying vec3 vColor;
  varying float vLift;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c);
    if (d > 0.25) discard;
    // Points the pointer has lifted catch the light.
    // Dark upholstery would vanish on carbon, so every point is lifted towards bone.
    vec3 colour = mix(vColor, uBone, clamp(0.22 + vLift * 0.7, 0.0, 0.95));
    gl_FragColor = vec4(colour, smoothstep(0.25, 0.12, d) * uIntro);
  }
`;

// The base colour texture as pixels, or null when the browser will not hand them over.
function pixelsOf(texture: THREE.Texture | null) {
  const image = texture?.image as (CanvasImageSource & { width: number; height: number }) | null;
  if (!image?.width) return null;
  const size = Math.min(512, image.width);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  try {
    ctx.drawImage(image, 0, 0, size, size);
    return { data: ctx.getImageData(0, 0, size, size).data, size };
  } catch {
    return null;
  }
}

export async function initPoints(root: HTMLElement, { scope }: { scope: Scope }) {
  const item = itemOf(ITEM);
  const still = prefersReducedMotion();
  const isSmall = window.matchMedia('(max-width: 768px)').matches;
  const count = isSmall ? 14_000 : 34_000;

  const model = await getModel(ITEM, { lod: isSmall ? 1 : 0 });
  if (!scope.alive) return;
  const { mesh, matrix } = meshData(model);
  const size = fit(item);
  // Model space → a piece of radius 1 centred on the origin.
  const place = new THREE.Matrix4()
    .makeTranslation(0, -size.cy, 0)
    .multiply(new THREE.Matrix4().makeScale(size.s, size.s, size.s))
    .multiply(matrix);

  const pixels = pixelsOf(standard(mesh).map);
  const sampler = new MeshSurfaceSampler(mesh).build();
  const positions = new Float32Array(count * 3);
  const colours = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const point = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const uv = new THREE.Vector2();
  // Seeds are deterministic, so each point keeps its size and drift between visits.
  let state = 0x9e3779b9;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    sampler.sample(point, normal, undefined, uv);
    point.applyMatrix4(place);
    positions.set([point.x, point.y, point.z], i * 3);
    seeds[i] = random();
    if (pixels) {
      const x = Math.min(pixels.size - 1, Math.max(0, Math.floor(uv.x * pixels.size)));
      const y = Math.min(pixels.size - 1, Math.max(0, Math.floor(uv.y * pixels.size)));
      const offset = (y * pixels.size + x) * 4;
      colours.set(
        [pixels.data[offset] / 255, pixels.data[offset + 1] / 255, pixels.data[offset + 2] / 255],
        i * 3,
      );
    } else {
      colours.set([0.925, 0.92, 0.905], i * 3);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colours, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);

  const uniforms = {
    uRayOrigin: { value: new THREE.Vector3(0, 50, 0) },
    uRayDir: { value: new THREE.Vector3(0, 0, -1) },
    uForce: { value: 0 },
    uIntro: { value: still ? 1 : 0 },
    uTime: { value: 0 },
    uSize: { value: 1 },
    uBone: { value: new THREE.Color(0.925, 0.92, 0.905) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: true,
  });
  const cloud = new THREE.Points(geometry, material);
  cloud.rotation.y = -0.55;

  const view = new View(getStage(), part(root, 'view'), { dpr: 1.75, fov: 26 });
  scope.add(() => view.dispose());
  view.scene.add(cloud);
  view.onResize = () => {
    // A wide hero frames the piece by height; a phone gives it most of the width.
    frame(view, { margin: view.pw > view.ph ? 0.9 : 0.62, elev: 0.14 });
    uniforms.uSize.value = view.ph * 0.0115;
  };
  view.onResize(view);

  // The pointer in the view, -1 to 1, and whether it is over the hero at all.
  const pointer = new THREE.Vector2(0, 0);
  const aim = new THREE.Vector2(0, 0);
  let isOver = false;
  scope.on(root, 'pointermove', (event) => {
    const rect = view.el.getBoundingClientRect();
    aim.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    );
    isOver = true;
    view.invalidate();
  });
  scope.on(root, 'pointerleave', () => {
    isOver = false;
  });

  const ray = new THREE.Raycaster();
  const inverse = new THREE.Matrix4();
  let spin = cloud.rotation.y;
  let wander = 0;

  view.tick = (dt, time) => {
    uniforms.uTime.value = time;
    uniforms.uIntro.value = Math.min(1, uniforms.uIntro.value + dt / 1.6);
    // Without a pointer (a phone, or the mouse elsewhere) a slow loop keeps the cloud moving.
    if (!isOver && !still) {
      wander += dt;
      aim.set(Math.sin(wander * 0.55) * 0.42, Math.sin(wander * 0.83) * 0.3);
    }
    const follow = 1 - Math.exp(-dt * 7);
    pointer.lerp(aim, follow);
    uniforms.uForce.value += ((isOver ? 1 : 0.55) - uniforms.uForce.value) * follow;

    if (!still) spin += dt * SPIN;
    cloud.rotation.y = spin + pointer.x * 0.5;
    cloud.rotation.x = -pointer.y * 0.22;
    cloud.updateMatrixWorld();

    ray.setFromCamera(pointer, view.camera);
    inverse.copy(cloud.matrixWorld).invert();
    uniforms.uRayOrigin.value.copy(ray.ray.origin).applyMatrix4(inverse);
    uniforms.uRayDir.value.copy(ray.ray.direction).transformDirection(inverse);
  };
  view.setPaused(still);
  view.start();
}
