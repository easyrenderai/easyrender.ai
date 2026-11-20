// Hub viewports: the grid thumbnails and the inspector inside an element's sheet.

import * as THREE from 'three';
import { itemOf } from '../catalog';
import { part } from '../dom';
import { disposeTree } from '../engine/resources';
import { getStage, prefersReducedMotion, View } from '../engine/stage';
import {
  addFloor,
  addStudioLights,
  type Fit,
  fitItem,
  frame,
  makeBeauty,
  makeCollider,
  makeShaded,
  makeWire,
  normalized,
} from '../engine/studio';
import type { Scope } from '../scope';

export type HubMode = 'beauty' | 'wire';
export type HubPass = 'beauty' | 'wire' | 'normal' | 'depth' | 'collider';

// ─────────── grid card ───────────
// Builds its viewport when the card scrolls near, renders once, and only spins while hovered.
export function mountCard(host: HTMLElement, id: string, scope: Scope, onReady: () => void) {
  const item = itemOf(id);
  const size = fitItem(item);
  const reduced = prefersReducedMotion();
  const objects: Partial<Record<HubMode, THREE.Group>> = {};
  let view: View | null = null;
  let pivot: THREE.Group | null = null;
  let floor: THREE.Group | null = null;
  let mode: HubMode = 'beauty';
  let hover = false;
  let angle = -0.55;

  async function show() {
    if (!view || !pivot) return;
    const wanted = mode;
    if (!objects[wanted]) {
      const object =
        wanted === 'wire'
          ? (await makeWire(id, { fill: 0x131315 })).object
          : await makeBeauty(id, { lod: 1 });
      if (!scope.alive) return;
      const group = normalized(object, item);
      group.visible = false;
      objects[wanted] = group;
      pivot.add(group);
    }
    if (wanted !== mode) return;
    for (const [key, group] of Object.entries(objects)) group.visible = key === wanted;
    if (floor) floor.visible = wanted === 'beauty';
    view.invalidate();
  }

  async function build() {
    const created = new View(getStage(), host, { fov: 24, dpr: 1.75 });
    scope.add(() => created.dispose());
    addStudioLights(created.scene);
    const group = new THREE.Group();
    created.scene.add(group);
    floor = addFloor(created.scene, { footprint: size.footprint, pool: 0.085 }).group;
    created.onResize = () => frame(created, { cy: size.cy, margin: 1.3, elev: 0.2 });
    created.onResize(created);
    created.tick = (dt) => {
      if (hover) angle += dt * 0.7;
      group.rotation.y = angle;
    };
    created.paused = !hover || reduced;
    view = created;
    pivot = group;
    await show();
    if (!scope.alive) return;
    created.start();
    onReady();
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      build().catch((error) => console.warn('hub card:', id, error));
    },
    { rootMargin: '500px 0px' },
  );
  observer.observe(host);
  scope.add(() => observer.disconnect());

  return {
    setMode(next: HubMode) {
      mode = next;
      show().catch(() => {});
    },
    setHover(next: boolean) {
      hover = next;
      view?.setPaused(!next || reduced);
    },
  };
}

// ─────────── sheet inspector ───────────
type Piece = 'beauty' | 'wire' | 'normal' | 'depth' | 'collider';

const SHOWN: Record<HubPass, Piece[]> = {
  beauty: ['beauty'],
  wire: ['wire'],
  normal: ['normal'],
  depth: ['depth'],
  collider: ['beauty', 'collider'],
};

async function makePiece(id: string, piece: Piece) {
  if (piece === 'beauty') return makeBeauty(id, { hd: true, shadows: true });
  if (piece === 'wire') return (await makeWire(id, { fill: 0x111113 })).object;
  if (piece === 'collider') return (await makeCollider(id)).object;
  return makeShaded(id, piece);
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function mountSheet(host: HTMLElement, scope: Scope) {
  const view = new View(getStage(), part(host, 'view'), { fov: 24 });
  addStudioLights(view.scene, { shadows: true });
  const floor = addFloor(view.scene, { receiveShadow: true, pool: 0.1 });
  const pivot = new THREE.Group();
  view.scene.add(pivot);

  const objects = new Map<string, THREE.Group>();
  scope.add(() => {
    view.dispose();
    for (const object of objects.values()) disposeTree(object);
  });

  const state = {
    id: '',
    pass: 'beauty' as HubPass,
    token: 0,
    angle: -0.55,
    elev: 0.2,
    margin: 1.25,
    auto: true,
    size: null as Fit | null,
  };

  const reframe = () => {
    if (!state.size) return;
    frame(view, {
      cy: state.size.cy,
      margin: state.margin,
      elev: state.elev,
      tightDepth: state.pass === 'depth',
    });
    view.invalidate();
  };
  view.onResize = reframe;
  view.tick = (dt) => {
    if (state.auto && !prefersReducedMotion()) state.angle += dt * 0.25;
    pivot.rotation.y = state.angle;
  };
  view.start();

  async function setPass(pass: HubPass) {
    state.pass = pass;
    const { token, id } = state;
    if (!id) return;
    const needed = SHOWN[pass];
    await Promise.all(
      needed.map(async (piece) => {
        const key = `${id}:${piece}`;
        if (objects.has(key)) return;
        const object = normalized(await makePiece(id, piece), itemOf(id));
        if (!scope.alive || objects.has(key)) return;
        object.visible = false;
        objects.set(key, object);
        pivot.add(object);
      }),
    );
    if (!scope.alive || token !== state.token || pass !== state.pass) return;
    for (const [key, object] of objects) {
      object.visible = needed.some((piece) => key === `${id}:${piece}`);
    }
    floor.group.visible = pass === 'beauty' || pass === 'collider';
    reframe();
  }

  // Orbit: drag to turn and tilt, wheel to zoom, arrows and +/- from the keyboard.
  let drag: { x: number; y: number } | null = null;
  scope.on(host, 'pointerdown', (event) => {
    if (event.button !== 0 || (event.target as Element).closest('button')) return;
    drag = { x: event.clientX, y: event.clientY };
    state.auto = false;
    host.setPointerCapture(event.pointerId);
    host.classList.add('is-dragging');
  });
  scope.on(host, 'pointermove', (event) => {
    if (!drag) return;
    state.angle += (event.clientX - drag.x) * 0.0085;
    state.elev = clamp(state.elev + (event.clientY - drag.y) * 0.006, 0.02, 1.25);
    drag = { x: event.clientX, y: event.clientY };
    reframe();
  });
  const release = () => {
    drag = null;
    host.classList.remove('is-dragging');
  };
  scope.on(host, 'pointerup', release);
  scope.on(host, 'pointercancel', release);
  scope.on(
    host,
    'wheel',
    (event) => {
      event.preventDefault();
      state.margin = clamp(state.margin * (1 + event.deltaY * 0.0012), 0.8, 2.6);
      reframe();
    },
    { passive: false },
  );
  scope.on(host, 'keydown', (event) => {
    const { key } = event;
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      state.angle += key === 'ArrowLeft' ? -0.2 : 0.2;
    } else if (key === 'ArrowUp' || key === 'ArrowDown') {
      state.elev = clamp(state.elev + (key === 'ArrowUp' ? 0.1 : -0.1), 0.02, 1.25);
    } else if (key === '+' || key === '=') {
      state.margin = Math.max(0.8, state.margin * 0.9);
    } else if (key === '-') {
      state.margin = Math.min(2.6, state.margin * 1.1);
    } else {
      return;
    }
    event.preventDefault();
    state.auto = false;
    reframe();
  });

  return {
    show(id: string) {
      state.token++;
      state.id = id;
      state.size = fitItem(itemOf(id));
      state.angle = -0.55;
      state.elev = 0.2;
      state.margin = 1.25;
      state.auto = true;
      for (const object of objects.values()) object.visible = false;
      floor.blob?.scale.set(state.size.footprint[0] * 1.5, state.size.footprint[1] * 1.5, 1);
      view.setPaused(false);
      return setPass('beauty');
    },
    setPass,
    pause() {
      view.setPaused(true);
    },
  };
}
