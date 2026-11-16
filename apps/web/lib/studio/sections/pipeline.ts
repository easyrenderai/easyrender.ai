// From photo to model: point cloud → mesh → texture, built from the floor up.

import * as THREE from 'three';
import { type CatalogItem, itemOf, photoUrl } from '../catalog';
import { part, parts, placeCursor } from '../dom';
import { getModel, meshData } from '../engine/assets';
import { disposeTree } from '../engine/resources';
import { getStage, prefersReducedMotion, View } from '../engine/stage';
import {
  addFloor,
  addStudioLights,
  ease,
  type Fit,
  fit,
  frame,
  INK,
  makeBeauty,
  makeWire,
  seg,
  type WirePass,
} from '../engine/studio';
import type { Format } from '../format';
import type { Scope } from '../scope';

const ITEMS = ['coffee-table', 'sneaker', 'lamp', 'bedside-table', 'cactus'];
// Seconds into the loop at which each beat starts.
const T = {
  photo: 0.35,
  type0: 1.0,
  type1: 2.7,
  click: 3.3,
  angles: 5.1,
  mesh: 7.2,
  tex: 9.6,
  hold: 13.4,
  total: 14.2,
};
// What an agent would call at each step.
const CALLS = {
  angles: 'create_render({ image_url })',
  mesh: 'render_3d({ id })',
  tex: 'get_render → building',
};

type Phase = 'idle' | 'photo' | 'type' | 'aim' | 'angles' | 'mesh' | 'tex' | 'done' | 'out';

type Built = {
  id: string;
  item: CatalogItem;
  size: Fit;
  group: THREE.Group;
  cloud: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  wire: WirePass;
  beauty: THREE.Object3D;
};

export type PipelineContext = { scope: Scope; fmt: Format; prompts: Record<string, string> };

export async function initPipeline(panel: HTMLElement, { scope, fmt, prompts }: PipelineContext) {
  const ui = {
    photo: part(panel, 'photo'),
    img: part<HTMLImageElement>(panel, 'photo-img'),
    text: part(panel, 'text'),
    button: part(panel, 'button'),
    steps: parts(panel, 'step'),
    readout: part(panel, 'readout'),
    cursor: part(panel, 'cursor'),
  };
  ui.img.src = photoUrl(ITEMS[0]);

  const view = new View(getStage(), part(panel, 'view'), { fov: 24 });
  scope.add(() => view.dispose());
  addStudioLights(view.scene, { shadows: true });
  addFloor(view.scene, { receiveShadow: true, pool: 0.09, contact: 0 });
  const pivot = new THREE.Group();
  view.scene.add(pivot);

  // Scan ring that rides the cut.
  const ring = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 97 }, (_, i) => {
        const a = (i / 96) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      }),
    ),
    new THREE.LineBasicMaterial({
      color: INK.bone,
      transparent: true,
      opacity: 0,
      toneMapped: false,
    }),
  );
  view.scene.add(ring);

  const keepBelow = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0); // y ≤ cut
  const keepAbove = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // y ≥ cut
  const pointsBelow = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);

  const cache = new Map<string, Promise<Built>>();
  const build = (id: string) => {
    let pending = cache.get(id);
    if (!pending) {
      pending = (async () => {
        const item = itemOf(id);
        const size = fit(item);
        const [wire, beauty, lod1] = await Promise.all([
          makeWire(id, { fill: 0x151517, opacity: 0.7 }),
          makeBeauty(id, { ownMaterials: true, shadows: true }),
          getModel(id, { lod: 1 }),
        ]);
        const source = meshData(lod1);
        const cloud = new THREE.Points(
          source.geometry,
          new THREE.PointsMaterial({
            color: INK.bone,
            size: 1.6 * Math.min(window.devicePixelRatio, 2),
            sizeAttenuation: false,
            transparent: true,
            opacity: 0.9,
            toneMapped: false,
          }),
        );
        cloud.applyMatrix4(source.matrix);
        cloud.material.clippingPlanes = [pointsBelow, keepAbove];
        beauty.traverse((node) => {
          const mesh = node as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
          if (!mesh.isMesh) return;
          mesh.material.clippingPlanes = [keepBelow];
          mesh.material.clipShadows = true;
        });
        const group = new THREE.Group();
        group.scale.setScalar(size.s);
        group.add(cloud, wire.object, beauty);
        return { id, item, size, group, cloud, wire, beauty };
      })();
      cache.set(id, pending);
    }
    return pending;
  };
  scope.add(() => {
    for (const pending of cache.values()) {
      pending.then((built) => disposeTree(built.group)).catch(() => {});
    }
  });

  let current: Built | null = null;
  let index = 0;
  let t = 0;
  let phase: Phase | '' = '';
  let typed = -1;
  let loading = false;

  const reframe = () => {
    if (!current) return;
    const wide = view.camera.aspect > 1.1;
    frame(view, {
      cy: current.size.cy,
      margin: wide ? 1.3 : 1.7,
      elev: 0.2,
      shiftX: wide ? 0.15 : 0,
      shiftY: wide ? 0 : 0.13,
    });
  };
  view.onResize = reframe;

  const setSteps = (active: number, done: number) => {
    ui.steps.forEach((step, i) => {
      step.classList.toggle('is-on', i === active);
      step.classList.toggle('is-done', i < done && i !== active);
    });
  };

  const say = (html: string) => {
    ui.readout.innerHTML = html;
    ui.readout.classList.add('is-on');
  };

  function mount(built: Built) {
    pivot.clear();
    pivot.add(built.group);
    current = built;
    ring.scale.setScalar(Math.max(built.size.footprint[0], built.size.footprint[1]) * 0.78);
    ui.img.src = photoUrl(built.id);
    reframe();
  }

  function enter(next: Phase) {
    if (next === phase || !current) return;
    phase = next;
    if (next === 'idle') {
      ui.photo.classList.remove('is-on');
      ui.text.textContent = '';
      ui.text.classList.remove('is-typing');
      ui.readout.classList.remove('is-on');
      ui.cursor.classList.remove('is-on');
      setSteps(-1, 0);
      typed = -1;
    } else if (next === 'photo') {
      ui.photo.classList.add('is-on');
      ui.cursor.classList.add('is-on');
      placeCursor(ui.cursor, panel, ui.text, 0.2, 0.6);
    } else if (next === 'type') {
      ui.text.classList.add('is-typing');
    } else if (next === 'aim') {
      ui.text.classList.remove('is-typing');
      placeCursor(ui.cursor, panel, ui.button, 0.5, 0.55);
    } else if (next === 'angles') {
      ui.button.classList.add('is-down');
      scope.timeout(() => ui.button.classList.remove('is-down'), 170);
      scope.timeout(() => ui.cursor.classList.remove('is-on'), 500);
      setSteps(0, 0);
      say(CALLS.angles);
    } else if (next === 'mesh') {
      setSteps(1, 1);
      say(CALLS.mesh);
    } else if (next === 'tex') {
      setSteps(2, 2);
      say(CALLS.tex);
    } else if (next === 'done') {
      setSteps(3, 3);
      const { item } = current;
      say(`<b>${fmt.int(item.lods[0].tris)}<span class="tri"></span></b> · GLB · USDZ`);
    } else if (next === 'out') {
      view.canvas.style.transition = 'opacity .55s';
      view.canvas.style.opacity = '0';
    }
  }

  function apply() {
    if (!current) return;
    const height = current.size.h * 1.03;
    const a = ease.inOut(seg(t, T.click, T.angles));
    const m = ease.inOut(seg(t, T.angles, T.mesh));
    const x = ease.inOut(seg(t, T.mesh, T.tex));

    // Points rise from the floor and give way to the mesh.
    pointsBelow.constant = a * height;
    current.cloud.visible = t > T.click && m < 1;
    current.cloud.material.opacity = 0.9 * (1 - m * 0.6);

    // The mesh grows over the points, then the texture replaces it from below.
    current.wire.object.visible = m > 0 && x < 1;
    current.beauty.visible = x > 0;
    const cut = (x > 0 ? x : m) * height;
    keepBelow.constant = cut;
    keepAbove.constant = -cut;
    const wirePlanes = [x > 0 ? keepAbove : keepBelow];
    current.wire.fill.material.clippingPlanes = wirePlanes;
    current.wire.lines.material.clippingPlanes = wirePlanes;

    const sweeping = (a > 0 && a < 1) || (m > 0 && m < 1) || (x > 0 && x < 1);
    ring.position.y = (x > 0 ? x : m > 0 ? m : a) * height;
    ring.material.opacity = sweeping ? 0.55 : 0;
  }

  const still = prefersReducedMotion();

  view.tick = (dt) => {
    if (!current) return;
    if (still) {
      pivot.rotation.y = -0.6;
      return;
    }
    t += dt;
    pivot.rotation.y = -0.75 + t * 0.2;

    if (t < T.photo) enter('idle');
    else if (t < T.type0) enter('photo');
    else if (t < T.type1) enter('type');
    else if (t < T.click) enter('aim');
    else if (t < T.angles) enter('angles');
    else if (t < T.mesh) enter('mesh');
    else if (t < T.tex) enter('tex');
    else if (t < T.hold) enter('done');
    else enter('out');

    if (phase === 'type') {
      const prompt = prompts[current.id] ?? '';
      const count = Math.round(seg(t, T.type0, T.type1 - 0.25) * prompt.length);
      if (count !== typed) {
        typed = count;
        ui.text.textContent = prompt.slice(0, count);
      }
    }
    apply();

    if (t >= T.total && !loading) {
      loading = true;
      index = (index + 1) % ITEMS.length;
      build(ITEMS[index])
        .then((built) => {
          if (!scope.alive) return;
          t = 0;
          phase = '';
          mount(built);
          enter('idle');
          apply();
          view.canvas.style.opacity = '1';
          loading = false;
        })
        .catch(() => {});
    }
  };

  const first = await build(ITEMS[0]);
  if (!scope.alive) return;
  mount(first);
  if (still) {
    // Final state, no animation.
    t = T.hold - 0.1;
    ui.photo.classList.add('is-on');
    ui.text.textContent = prompts[first.id] ?? '';
    enter('done');
    apply();
    view.paused = true;
  } else {
    enter('idle');
    apply();
  }
  view.start();
  scope.add(() => {
    ui.photo.classList.remove('is-on');
    ui.readout.classList.remove('is-on');
    ui.cursor.classList.remove('is-on');
    ui.text.classList.remove('is-typing');
    ui.text.textContent = '';
    setSteps(-1, 0);
  });
  build(ITEMS[1]).catch(() => {});
}
