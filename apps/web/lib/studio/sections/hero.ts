// Hero: one object, five readings kept in sync (photo, mesh, normals, depth, render).

import * as THREE from 'three';
import { WebGLUnavailableError } from '@/lib/webgl';
import { itemOf, photoUrl } from '../catalog';
import { part } from '../dom';
import { preload } from '../engine/assets';
import { disposeTree } from '../engine/resources';
import { getStage, prefersReducedMotion, View } from '../engine/stage';
import {
  addFloor,
  addStudioLights,
  type Fit,
  fit,
  frame,
  makeBeauty,
  makeShaded,
  makeWire,
  normalized,
} from '../engine/studio';
import type { Format } from '../format';
import { Scope } from '../scope';

const ORDER = [
  'swivel-chair',
  'lamp',
  'bedside-table',
  'crate',
  'coffee-table',
  'sneaker',
  'cactus',
  'barrel',
];
const PASSES = ['wire', 'depth', 'normal', 'beauty'] as const;
type Pass = (typeof PASSES)[number];
type PassSet = Record<Pass, THREE.Group>;

const HOLD = 7; // seconds per object
const SPIN = 0.24; // rad/s

export type HeroContext = { scope: Scope; fmt: Format; names: Record<string, string> };

export async function initHero(root: HTMLElement, context: HeroContext) {
  const scope = new Scope();
  context.scope.add(() => scope.dispose());
  try {
    await startHero(root, { ...context, scope });
  } catch (error) {
    if (!scope.alive) return;
    scope.dispose();
    const stack = part(root, 'stack');
    const photo = part<HTMLImageElement>(root, 'photo');
    photo.src = photoUrl(ORDER[0]);
    stack.classList.add('is-in', 'is-fallback');
    context.scope.add(() => stack.classList.remove('is-in', 'is-fallback'));
    if (!(error instanceof WebGLUnavailableError)) {
      console.warn('studio hero: 3D is not available', error);
    }
  }
}

async function startHero(root: HTMLElement, { scope, fmt, names }: HeroContext) {
  if (!scope.alive) return;
  const stack = part(root, 'stack');
  const stage = getStage();
  const ui = {
    photo: part<HTMLImageElement>(root, 'photo'),
    tris: part(root, 'tris'),
    name: part(root, 'name'),
  };

  type PassView = { view: View; pivot: THREE.Group; fit: Fit | null; blob: THREE.Mesh | null };
  const views = {} as Record<Pass, PassView>;
  for (const pass of PASSES) {
    const view = new View(stage, part(stack, pass), { fov: 24 });
    scope.add(() => view.dispose());
    const pivot = new THREE.Group();
    view.scene.add(pivot);
    const entry: PassView = { view, pivot, fit: null, blob: null };
    if (pass === 'beauty') {
      addStudioLights(view.scene, { shadows: true });
      entry.blob = addFloor(view.scene, { receiveShadow: true, pool: 0.1 }).blob;
    }
    view.onResize = () => {
      if (!entry.fit) return;
      frame(view, {
        cy: entry.fit.cy,
        margin: pass === 'beauty' ? 1.22 : 1.12,
        elev: 0.2,
        tightDepth: pass === 'depth',
      });
    };
    views[pass] = entry;
  }

  // On a phone each card is a couple of hundred pixels wide: LOD1 is indistinguishable there and
  // a third of the download.
  const lod = window.matchMedia('(max-width: 768px)').matches ? 1 : 0;

  const built = new Map<string, Promise<PassSet>>();
  const build = (id: string) => {
    let pending = built.get(id);
    if (!pending) {
      const item = itemOf(id);
      pending = Promise.all([
        makeWire(id, { fill: 0x111113 }).then((wire) => wire.object),
        makeShaded(id, 'depth', { lod }),
        makeShaded(id, 'normal', { lod }),
        makeBeauty(id, { lod, shadows: true }),
      ]).then(([wire, depth, normal, beauty]) => ({
        wire: normalized(wire, item),
        depth: normalized(depth, item),
        normal: normalized(normal, item),
        beauty: normalized(beauty, item),
      }));
      built.set(id, pending);
    }
    return pending;
  };
  scope.add(() => {
    for (const pending of built.values()) {
      pending.then((set) => Object.values(set).forEach(disposeTree)).catch(() => {});
    }
  });

  let angle = -0.55;
  let velocity = 0;
  let dragging = false;
  const auto = !prefersReducedMotion();

  function show(id: string, set: PassSet) {
    const item = itemOf(id);
    const size = fit(item);
    for (const pass of PASSES) {
      const entry = views[pass];
      entry.pivot.clear();
      entry.pivot.add(set[pass]);
      entry.fit = size;
      entry.view.onResize?.(entry.view);
      entry.blob?.scale.set(size.footprint[0] * 1.5, size.footprint[1] * 1.5, 1);
      entry.view.invalidate();
    }
    ui.photo.src = photoUrl(id);
    ui.tris.textContent = fmt.int(item.wireTris);
    ui.name.textContent = names[id] ?? id;
  }

  let index = 0;
  const first = await build(ORDER[0]);
  if (!scope.alive) return;
  show(ORDER[0], first);

  let clock = 0;
  let swapping = false;

  async function next() {
    swapping = true;
    index = (index + 1) % ORDER.length;
    const id = ORDER[index];
    const set = await build(id);
    if (!scope.alive) return;
    stack.classList.add('is-swapping');
    await scope.wait(460);
    if (!scope.alive) return;
    show(id, set);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    stack.classList.remove('is-swapping');
    clock = 0;
    swapping = false;
    build(ORDER[(index + 1) % ORDER.length]).catch(() => {});
  }

  for (const pass of PASSES) {
    const { view, pivot } = views[pass];
    view.tick = (dt) => {
      if (pass === 'beauty' && !dragging) {
        angle += (auto ? SPIN : 0) * dt + velocity * dt;
        velocity *= 0.04 ** dt;
        clock += dt;
        if (auto && clock > HOLD && !swapping) next().catch(() => {});
      }
      pivot.rotation.y = angle;
    };
    view.paused = !auto;
    view.start();
  }
  requestAnimationFrame(() => stack.classList.add('is-in'));
  scope.add(() => stack.classList.remove('is-in', 'is-swapping', 'is-dragging', 'has-dragged'));
  build(ORDER[1]).catch(() => {});

  // Drag to turn: every pass follows.
  let lastX = 0;
  let lastT = 0;
  const invalidate = () => {
    for (const pass of PASSES) views[pass].view.invalidate();
  };
  const setPaused = (paused: boolean) => {
    for (const pass of PASSES) views[pass].view.setPaused(paused);
  };
  scope.on(stack, 'pointerdown', (event) => {
    if (event.button !== 0) return;
    dragging = true;
    lastX = event.clientX;
    lastT = performance.now();
    velocity = 0;
    stack.setPointerCapture(event.pointerId);
    stack.classList.add('is-dragging', 'has-dragged');
  });
  scope.on(stack, 'pointermove', (event) => {
    if (!dragging) return;
    const now = performance.now();
    const delta = (event.clientX - lastX) * 0.0085;
    angle += delta;
    velocity = (delta / Math.max(1, now - lastT)) * 1000 * 0.6;
    lastX = event.clientX;
    lastT = now;
    clock = Math.min(clock, HOLD - 3); // hold the current object while it is being handled
    invalidate();
  });
  const release = (event: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    stack.classList.remove('is-dragging');
    if (stack.hasPointerCapture(event.pointerId)) stack.releasePointerCapture(event.pointerId);
    if (!auto) {
      // Reduced motion: a short glide after the drag, then still again.
      setPaused(false);
      scope.timeout(() => {
        velocity = 0;
        setPaused(true);
      }, 900);
    }
  };
  scope.on(stack, 'pointerup', release);
  scope.on(stack, 'pointercancel', release);

  preload(ORDER.slice(1, 3), lod);
}
