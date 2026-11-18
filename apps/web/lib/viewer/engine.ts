import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createStudioEnvironment, disposeStudioEnvironment } from '@/lib/studio/engine/environment';
import { WebGLUnavailableError } from '@/lib/webgl';
import { isZUpFormat, type ViewerFormat } from './formats';
import { loadModel } from './load';
import { describeModel, type ModelStats, materialsOf, texturesOf } from './stats';

// The viewer behind /3d-viewer: one canvas, one model at a time, orbit controls and the studio
// lighting the rest of the site uses. Framework-free; the React component only calls this API.

export type ModelInfo = ModelStats & {
  format: ViewerFormat;
  animations: number;
  missing: string[];
};

export type Viewer = {
  /** Replaces the current model. Rejects when the file cannot be parsed. */
  open: (files: readonly File[], main: File, format: ViewerFormat) => Promise<ModelInfo | null>;
  resetView: () => void;
  setAutoRotate: (isOn: boolean) => void;
  setWireframe: (isOn: boolean) => void;
  setGrid: (isOn: boolean) => void;
  setPlaying: (isOn: boolean) => void;
  /** Swaps the up axis between Y and Z and returns the new bounding box size. */
  flipUpAxis: () => [number, number, number];
  screenshot: () => Promise<Blob | null>;
  dispose: () => void;
};

const VIEW_DIRECTION = new THREE.Vector3(0.9, 0.55, 1.15).normalize();

function disposeObject(object: THREE.Object3D) {
  const materials = materialsOf(object);
  for (const texture of texturesOf(materials)) texture.dispose();
  for (const material of materials) material.dispose();
  object.traverse((node) => {
    (node as THREE.Mesh).geometry?.dispose();
  });
}

export function createViewer(canvas: HTMLCanvasElement): Viewer {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    throw new WebGLUnavailableError();
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const studio = createStudioEnvironment();
  const environment = pmrem.fromScene(studio, 0.03);
  disposeStudioEnvironment(studio);
  pmrem.dispose();
  scene.environment = environment.texture;
  scene.environmentIntensity = 1.6;

  // Image-based light does nothing for the Phong and Lambert materials OBJ, FBX and Collada
  // files carry, so the same key, rim and fill are also real lights.
  const key = new THREE.DirectionalLight(0xfff1e0, 1.6);
  key.position.set(2.4, 3.6, 2.8);
  const rim = new THREE.DirectionalLight(0xc9dcff, 1.2);
  rim.position.set(-3, 2.4, -3.2);
  scene.add(key, rim, new THREE.HemisphereLight(0xffffff, 0x3a3a40, 0.9));

  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotateSpeed = 1.6;
  controls.zoomToCursor = true;

  // The pivot carries the up-axis correction; the model keeps its own transform and units.
  const pivot = new THREE.Group();
  scene.add(pivot);
  let grid: THREE.GridHelper | null = null;
  let isGridOn = true;
  let isWireframeOn = false;
  let model: THREE.Object3D | null = null;
  let release = () => {};
  let mixer: THREE.AnimationMixer | null = null;
  let isPlaying = true;
  let request = 0;
  let isDirty = true;
  let isDisposed = false;
  let radius = 1;
  const center = new THREE.Vector3();

  function frame(isCameraReset: boolean) {
    pivot.position.set(0, 0, 0);
    pivot.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(pivot);
    if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
    // Stand the model on the floor, centred.
    const middle = box.getCenter(new THREE.Vector3());
    pivot.position.set(-middle.x, -box.min.y, -middle.z);
    const size = box.getSize(new THREE.Vector3());
    center.set(0, size.y / 2, 0);
    radius = Math.max(size.length() / 2, 1e-6);

    if (grid) {
      scene.remove(grid);
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
    }
    // A cell is the power of ten just under the model's footprint, so the grid reads as a scale.
    const cell = 10 ** Math.floor(Math.log10(Math.max(size.x, size.z, size.y) || 1));
    const cells = Math.max(10, Math.ceil((radius * 4) / cell / 2) * 2);
    grid = new THREE.GridHelper(cell * cells, cells, 0x909095, 0x909095);
    const material = grid.material as THREE.LineBasicMaterial;
    material.transparent = true;
    material.opacity = 0.28;
    material.depthWrite = false;
    grid.visible = isGridOn;
    scene.add(grid);

    pivot.traverse((node) => {
      const points = node as THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
      if (points.isPoints) points.material.size = radius / 150;
    });

    if (isCameraReset) resetView();
    isDirty = true;
    return size;
  }

  function resetView() {
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const fit = Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * camera.aspect));
    const distance = (radius / Math.sin(fit / 2)) * 1.08;
    camera.position.copy(center).addScaledVector(VIEW_DIRECTION, distance);
    camera.near = distance / 200;
    camera.far = distance * 200;
    camera.updateProjectionMatrix();
    controls.target.copy(center);
    controls.minDistance = radius * 0.02;
    controls.maxDistance = distance * 12;
    controls.update();
    isDirty = true;
  }

  function resize() {
    const { clientWidth: width, clientHeight: height } = canvas;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    isDirty = true;
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  function applyWireframe() {
    if (!model) return;
    for (const material of materialsOf(model)) {
      if ('wireframe' in material) material.wireframe = isWireframeOn;
    }
    isDirty = true;
  }

  function clear() {
    mixer?.stopAllAction();
    mixer = null;
    if (model) {
      pivot.remove(model);
      disposeObject(model);
      model = null;
    }
    release();
    release = () => {};
  }

  let last = performance.now();
  function tick(now: number) {
    if (isDisposed) return;
    const delta = Math.min((now - last) / 1000, 0.1);
    last = now;
    const isAnimating = Boolean(mixer && isPlaying);
    if (isAnimating) mixer?.update(delta);
    const hasMoved = controls.update(delta);
    // Draw only when something changed: an idle viewer costs nothing.
    if (isDirty || hasMoved || isAnimating) {
      renderer.render(scene, camera);
      isDirty = false;
    }
    frameId = requestAnimationFrame(tick);
  }
  let frameId = requestAnimationFrame(tick);

  return {
    async open(files, main, format) {
      const id = ++request;
      const loaded = await loadModel(files, main, format, renderer);
      // A newer file was dropped, or the page was left, while this one was parsing.
      if (id !== request || isDisposed) {
        disposeObject(loaded.object);
        loaded.release();
        return null;
      }
      clear();
      model = loaded.object;
      release = loaded.release;
      pivot.rotation.set(isZUpFormat(format) ? -Math.PI / 2 : 0, 0, 0);
      pivot.add(model);
      if (loaded.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        mixer.clipAction(loaded.animations[0]).play();
        mixer.update(0);
      }
      applyWireframe();
      const stats = describeModel(model);
      const size = frame(true);
      return {
        ...stats,
        size: [size.x, size.y, size.z],
        format,
        animations: loaded.animations.length,
        missing: loaded.missing,
      };
    },
    resetView,
    setAutoRotate(isOn) {
      controls.autoRotate = isOn;
    },
    setWireframe(isOn) {
      isWireframeOn = isOn;
      applyWireframe();
    },
    setGrid(isOn) {
      isGridOn = isOn;
      if (grid) grid.visible = isOn;
      isDirty = true;
    },
    setPlaying(isOn) {
      isPlaying = isOn;
    },
    flipUpAxis() {
      pivot.rotation.x = pivot.rotation.x === 0 ? -Math.PI / 2 : 0;
      const size = frame(true);
      return [size.x, size.y, size.z];
    },
    screenshot() {
      renderer.render(scene, camera);
      return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    },
    dispose() {
      isDisposed = true;
      request += 1;
      cancelAnimationFrame(frameId);
      observer.disconnect();
      clear();
      controls.dispose();
      environment.dispose();
      if (grid) {
        grid.geometry.dispose();
        (grid.material as THREE.Material).dispose();
      }
      renderer.dispose();
    },
  };
}
