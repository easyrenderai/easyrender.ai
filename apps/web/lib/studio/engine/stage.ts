// One WebGL context for the whole page.
// Every viewport is an ordinary 2D <canvas> in the DOM (so it stacks, clips and animates with
// CSS); the shared renderer draws each scene into its buffer and copies it across. That keeps
// dozens of live viewports on a page without hitting the browser's WebGL context limit.

import * as THREE from 'three';
import { hasWebGL, WebGLUnavailableError } from '@/lib/webgl';
import { createStudioEnvironment, disposeStudioEnvironment } from './environment';
import { disposeTree } from './resources';

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export type Tick = (dt: number, time: number, view: View) => void;

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly env: THREE.Texture;
  time = 0;
  #views = new Set<View>();
  #byElement = new WeakMap<Element, View>();
  #bufW = 0;
  #bufH = 0;
  #last = 0;
  #raf = 0;
  #io: IntersectionObserver;
  #ro: ResizeObserver;

  constructor() {
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Khronos PBR Neutral keeps a product's base colour true, which is what a store needs.
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.localClippingEnabled = true;
    renderer.autoClear = false;
    this.renderer = renderer;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const studio = createStudioEnvironment();
    this.env = pmrem.fromScene(studio, 0.02).texture;
    disposeStudioEnvironment(studio);
    pmrem.dispose();

    this.#io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const view = this.#byElement.get(entry.target);
          if (!view) continue;
          view.inView = entry.isIntersecting;
          if (view.inView) view.dirty = true;
        }
        this.#wake();
      },
      { rootMargin: '160px 0px' },
    );
    this.#ro = new ResizeObserver((entries) => {
      for (const entry of entries) this.#byElement.get(entry.target)?.resize();
      this.#wake();
    });

    document.addEventListener('visibilitychange', () => this.#wake());
    canvas.addEventListener('webglcontextlost', (event) => event.preventDefault());
    canvas.addEventListener('webglcontextrestored', () => {
      for (const view of this.#views) view.dirty = true;
      this.#wake();
    });
  }

  add(view: View) {
    this.#views.add(view);
    this.#byElement.set(view.el, view);
    this.#io.observe(view.el);
    this.#ro.observe(view.el);
    view.resize();
    this.#wake();
  }

  remove(view: View) {
    this.#views.delete(view);
    this.#byElement.delete(view.el);
    this.#io.unobserve(view.el);
    this.#ro.unobserve(view.el);
  }

  requestRender() {
    this.#wake();
  }

  // Renders a view once and returns it as a data URL (hub thumbnails).
  snapshot(view: View, type = 'image/webp', quality = 0.9) {
    view.tick?.(0, this.time, view);
    this.#draw(view);
    return view.canvas.toDataURL(type, quality);
  }

  #wake() {
    if (this.#raf || document.hidden) return;
    this.#last = performance.now();
    this.#raf = requestAnimationFrame((now) => this.#frame(now));
  }

  #frame(now: number) {
    this.#raf = 0;
    const dt = Math.min(0.05, Math.max(0, (now - this.#last) / 1000));
    this.#last = now;
    this.time += dt;

    let active = 0;
    for (const view of this.#views) {
      if (!view.inView || !view.ready || view.pw < 2 || view.ph < 2) continue;
      if (view.paused && !view.dirty) continue;
      view.tick?.(dt, this.time, view);
      this.#draw(view);
      view.dirty = false;
      if (!view.paused) active++;
    }
    if (active > 0 && !document.hidden) {
      this.#raf = requestAnimationFrame((next) => this.#frame(next));
    }
  }

  #draw(view: View) {
    const renderer = this.renderer;
    const { pw: w, ph: h } = view;
    if (w > this.#bufW || h > this.#bufH) {
      this.#bufW = Math.max(this.#bufW, w);
      this.#bufH = Math.max(this.#bufH, h);
      renderer.setSize(this.#bufW, this.#bufH, false);
    }
    renderer.setViewport(0, 0, w, h);
    renderer.setScissor(0, 0, w, h);
    renderer.setScissorTest(true);
    renderer.setClearColor(view.clearColor, view.clearAlpha);
    renderer.clear(true, true, true);
    if (view.render) view.render(renderer, view);
    else renderer.render(view.scene, view.camera);
    view.ctx.globalCompositeOperation = 'copy';
    view.ctx.drawImage(renderer.domElement, 0, this.#bufH - h, w, h, 0, 0, w, h);
  }
}

export type ViewOptions = {
  fov?: number;
  // Opaque background colour; leave it out to let the CSS behind the canvas show through.
  bg?: THREE.ColorRepresentation | null;
  dpr?: number;
  envIntensity?: number;
};

export class View {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly clearColor: THREE.Color;
  readonly clearAlpha: number;
  pw = 0;
  ph = 0;
  inView = false;
  ready = false;
  paused = false;
  dirty = true;
  tick: Tick | null = null;
  render: ((renderer: THREE.WebGLRenderer, view: View) => void) | null = null;
  onResize: ((view: View) => void) | null = null;
  #dprCap: number;

  constructor(
    readonly stage: Stage,
    readonly el: HTMLElement,
    options: ViewOptions = {},
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'view-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    Object.assign(this.canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
    });
    el.prepend(this.canvas);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas is not available');
    this.ctx = ctx;

    this.scene.environment = stage.env;
    this.scene.environmentIntensity = options.envIntensity ?? 0.3;
    this.camera = new THREE.PerspectiveCamera(options.fov ?? 26, 1, 0.02, 60);

    this.#dprCap = options.dpr ?? 2;
    this.clearColor = new THREE.Color(options.bg ?? 0x000000);
    this.clearAlpha = options.bg == null ? 0 : 1;

    stage.add(this);
  }

  resize() {
    const w = this.el.clientWidth;
    const h = this.el.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, this.#dprCap);
    const pw = Math.round(w * dpr);
    const ph = Math.round(h * dpr);
    if (pw === this.pw && ph === this.ph) return;
    this.pw = pw;
    this.ph = ph;
    this.canvas.width = pw;
    this.canvas.height = ph;
    this.camera.aspect = pw / ph;
    this.camera.updateProjectionMatrix();
    this.onResize?.(this);
    this.dirty = true;
  }

  start() {
    this.ready = true;
    this.dirty = true;
    this.stage.requestRender();
    return this;
  }

  invalidate() {
    this.dirty = true;
    this.stage.requestRender();
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    if (!paused) this.stage.requestRender();
  }

  dispose() {
    this.ready = false;
    this.stage.remove(this);
    this.canvas.remove();
    disposeTree(this.scene);
  }
}

let stage: Stage | null = null;

// Throws WebGLUnavailableError when the browser has no WebGL. Probing first keeps three.js from
// logging its own error and rethrowing "Error creating WebGL context." from the constructor.
export function getStage() {
  if (!stage && !hasWebGL()) throw new WebGLUnavailableError();
  stage ??= new Stage();
  return stage;
}
