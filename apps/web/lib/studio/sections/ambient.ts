// Ambient: one object turning slowly behind a page's heading, as a hidden-line mesh. On request
// (the `data-solid` attribute on the root) the same object fades to its textured render.

import * as THREE from 'three';
import { itemOf } from '../catalog';
import { part } from '../dom';
import { getStage, prefersReducedMotion, View } from '../engine/stage';
import {
  addStudioLights,
  fit,
  frame,
  INK,
  makeBeauty,
  makeWire,
  normalized,
} from '../engine/studio';
import type { Scope } from '../scope';

const SPIN = 0.16; // rad/s
const START = -0.6;

export async function initAmbient(root: HTMLElement, { scope, id }: { scope: Scope; id: string }) {
  const stage = getStage();
  const item = itemOf(id);
  const size = fit(item);
  const isMoving = !prefersReducedMotion();

  const open = (name: 'wire' | 'beauty') => {
    const view = new View(stage, part(root, name), { fov: 24 });
    scope.add(() => view.dispose());
    const pivot = new THREE.Group();
    pivot.rotation.y = START;
    view.scene.add(pivot);
    view.onResize = () => frame(view, { cy: size.cy, margin: 1.12, elev: 0.2 });
    // Both readings follow the clock, so they stay aligned while one fades into the other.
    view.tick = (_dt, time) => {
      pivot.rotation.y = START + SPIN * time;
    };
    view.paused = !isMoving;
    return { view, pivot };
  };

  const wire = open('wire');
  // The fill hides the far side of the mesh; in the page colour it reads as lines only.
  const mesh = await makeWire(id, { fill: INK.carbon, opacity: 0.7 });
  if (!scope.alive) return;
  wire.pivot.add(normalized(mesh.object, item));
  wire.view.onResize?.(wire.view);
  wire.view.start();
  requestAnimationFrame(() => root.classList.add('is-in'));
  scope.add(() => root.classList.remove('is-in', 'is-solid'));

  // The textured model is only downloaded when the page asks for it.
  let hasBeauty = false;
  async function solidify() {
    if (hasBeauty || !root.hasAttribute('data-solid')) return;
    hasBeauty = true;
    const beauty = open('beauty');
    addStudioLights(beauty.view.scene);
    const lod = window.matchMedia('(max-width: 768px)').matches ? 1 : 0;
    const model = await makeBeauty(id, { lod });
    if (!scope.alive) return;
    beauty.pivot.add(normalized(model, item));
    beauty.view.onResize?.(beauty.view);
    beauty.view.start();
    requestAnimationFrame(() => root.classList.add('is-solid'));
  }
  const observer = new MutationObserver(() => {
    solidify().catch(() => {});
  });
  observer.observe(root, { attributes: true, attributeFilter: ['data-solid'] });
  scope.add(() => observer.disconnect());
  await solidify();
}
