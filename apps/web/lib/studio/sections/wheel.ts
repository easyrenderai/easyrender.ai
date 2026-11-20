// The flywheel: store → hub → studio → shopper. A dot travels the ring while the piece in the
// middle goes from photo to mesh to render.

import * as THREE from 'three';
import { itemOf, photoUrl } from '../catalog';
import { part, parts } from '../dom';
import { disposeTree } from '../engine/resources';
import { getStage, prefersReducedMotion, View } from '../engine/stage';
import {
  addFloor,
  addStudioLights,
  type Fit,
  fitItem,
  frame,
  makeBeauty,
  makeWire,
  normalized,
} from '../engine/studio';
import type { Scope } from '../scope';

const ITEMS = ['bedside-table', 'lamp', 'coffee-table'];
const LAP = 17; // seconds per turn
const START = -135; // degrees: the first stop sits top left
const RADIUS = 250; // in the 600×600 ring viewBox

type Built = { id: string; size: Fit; wire: THREE.Group; beauty: THREE.Group };

export async function initWheel(panel: HTMLElement, { scope }: { scope: Scope }) {
  const wheel = part(panel, 'wheel');
  const arc = part<SVGCircleElement>(panel, 'arc');
  const dot = part<SVGCircleElement>(panel, 'dot');
  const stops = parts(panel, 'stop');
  const photo = part<HTMLImageElement>(panel, 'photo');

  const view = new View(getStage(), part(panel, 'view'), { fov: 24 });
  scope.add(() => view.dispose());
  addStudioLights(view.scene, { shadows: true });
  const floor = addFloor(view.scene, { receiveShadow: true, pool: 0, contact: 0.5 });
  const pivot = new THREE.Group();
  view.scene.add(pivot);

  const cache = new Map<string, Promise<Built>>();
  const build = (id: string) => {
    let pending = cache.get(id);
    if (!pending) {
      const item = itemOf(id);
      pending = Promise.all([
        makeWire(id, { fill: 0x161618 }),
        makeBeauty(id, { shadows: true }),
      ]).then(([wire, beauty]) => ({
        id,
        size: fitItem(item),
        wire: normalized(wire.object, item),
        beauty: normalized(beauty, item),
      }));
      cache.set(id, pending);
    }
    return pending;
  };
  scope.add(() => {
    for (const pending of cache.values()) {
      pending
        .then((built) => {
          disposeTree(built.wire);
          disposeTree(built.beauty);
        })
        .catch(() => {});
    }
  });

  let current: Built | null = null;
  view.onResize = () => {
    if (current) frame(view, { cy: current.size.cy, margin: 1.2, elev: 0.2 });
  };

  let active = -1;
  const setStop = (index: number) => {
    if (index === active) return;
    active = index;
    stops.forEach((stop, i) => {
      stop.classList.toggle('is-on', i === index);
    });
    wheel.dataset.stop = String(index);
    if (current) {
      current.wire.visible = index === 1;
      current.beauty.visible = index >= 2;
    }
  };

  function mount(built: Built) {
    current = built;
    pivot.clear();
    pivot.add(built.wire, built.beauty);
    floor.blob?.scale.set(built.size.footprint[0] * 1.5, built.size.footprint[1] * 1.5, 1);
    photo.src = photoUrl(built.id);
    view.onResize?.(view);
  }

  const place = (p: number) => {
    const a = ((START + p * 360) * Math.PI) / 180;
    dot.setAttribute('cx', (300 + RADIUS * Math.cos(a)).toFixed(2));
    dot.setAttribute('cy', (300 + RADIUS * Math.sin(a)).toFixed(2));
    arc.style.strokeDasharray = `${(p * 100).toFixed(2)} 100`;
  };

  const first = await build(ITEMS[0]);
  if (!scope.alive) return;
  mount(first);
  scope.add(() => {
    delete wheel.dataset.stop;
    for (const stop of stops) stop.classList.remove('is-on');
  });

  if (prefersReducedMotion()) {
    place(0.999);
    setStop(2);
    for (const stop of stops) stop.classList.add('is-on');
    pivot.rotation.y = -0.5;
    view.paused = true;
    view.start();
    return;
  }

  let t = 0;
  let lap = 0;
  let item = 0;
  let swapping = false;
  setStop(0);
  place(0);
  view.tick = (dt) => {
    t += dt;
    const turn = Math.floor(t / LAP);
    const p = (t % LAP) / LAP;
    if (turn !== lap && !swapping) {
      lap = turn;
      swapping = true;
      item = (item + 1) % ITEMS.length;
      build(ITEMS[item])
        .then((built) => {
          if (!scope.alive) return;
          mount(built);
          active = -1;
          swapping = false;
        })
        .catch(() => {});
    }
    setStop(Math.min(3, Math.floor(p * 4)));
    place(p);
    pivot.rotation.y = -0.6 + t * 0.22;
  };
  view.start();
  build(ITEMS[1]).catch(() => {});
}
