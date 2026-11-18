import * as THREE from 'three';
import { extensionOf, resourceName, type ViewerFormat } from './formats';

// Parses the dropped files into a three.js object, entirely in the browser: nothing is uploaded.
// Each loader is imported on demand, so opening a GLB never downloads the FBX parser.

export type LoadedModel = {
  object: THREE.Object3D;
  animations: THREE.AnimationClip[];
  /** Files the model refers to that were not dropped with it (a .bin, a .mtl, a texture). */
  missing: string[];
  /** Releases the object URLs made for the companion files. */
  release: () => void;
};

/** The model could not be read because files it depends on were not dropped with it. */
export class MissingFilesError extends Error {
  constructor(readonly files: string[]) {
    super(`Missing files: ${files.join(', ')}`);
    this.name = 'MissingFilesError';
  }
}

const DECODERS = '/studio/decoders';
// A file that is referred to but was not dropped resolves to an empty body instead of a request
// to our own server for "texture.png".
const EMPTY = 'data:application/octet-stream;base64,';

function plainMaterial(geometry: THREE.BufferGeometry) {
  return new THREE.MeshStandardMaterial({
    color: 0xb9b8b4,
    roughness: 0.62,
    metalness: 0,
    vertexColors: geometry.hasAttribute('color'),
    side: THREE.DoubleSide,
  });
}

// STL and PLY carry geometry only, so they get a neutral material. A PLY with no faces is a
// point cloud; the viewer sizes its points once it knows how large the model is.
function fromGeometry(geometry: THREE.BufferGeometry, isPointCloud = false): THREE.Object3D {
  if (isPointCloud) {
    return new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color: 0xb9b8b4, vertexColors: geometry.hasAttribute('color') }),
    );
  }
  if (!geometry.hasAttribute('normal')) geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, plainMaterial(geometry));
}

const text = (file: File) => file.text();
const bytes = (file: File) => file.arrayBuffer();

export async function loadModel(
  files: readonly File[],
  main: File,
  format: ViewerFormat,
  /** Null when there is no WebGL: everything loads except GPU-compressed (KTX2) textures. */
  renderer: THREE.WebGLRenderer | null,
): Promise<LoadedModel> {
  const urls = new Map<string, string>();
  for (const file of files) {
    if (file !== main) urls.set(file.name.toLowerCase(), URL.createObjectURL(file));
  }
  const missing = new Set<string>();
  const release = () => {
    for (const url of urls.values()) URL.revokeObjectURL(url);
  };

  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    if (/^(blob|data):/i.test(url) || url.startsWith(DECODERS)) return url;
    const name = resourceName(url);
    const found = urls.get(name);
    if (found) return found;
    if (name) missing.add(name);
    return EMPTY;
  });
  // Textures decode after the parser has returned; wait for them so the first frame is complete.
  let isPending = false;
  let onSettled = () => {};
  manager.onStart = () => {
    isPending = true;
  };
  manager.onLoad = () => {
    isPending = false;
    onSettled();
  };

  try {
    let object: THREE.Object3D;
    let animations: THREE.AnimationClip[] = [];

    if (format === 'glb' || format === 'gltf') {
      const [{ GLTFLoader }, { DRACOLoader }, { KTX2Loader }, { MeshoptDecoder }] =
        await Promise.all([
          import('three/addons/loaders/GLTFLoader.js'),
          import('three/addons/loaders/DRACOLoader.js'),
          import('three/addons/loaders/KTX2Loader.js'),
          import('three/addons/libs/meshopt_decoder.module.js'),
        ]);
      const draco = new DRACOLoader().setDecoderPath(`${DECODERS}/draco/`);
      const ktx2 = new KTX2Loader().setTranscoderPath(`${DECODERS}/basis/`);
      const loader = new GLTFLoader(manager)
        .setDRACOLoader(draco)
        .setMeshoptDecoder(MeshoptDecoder);
      if (renderer) loader.setKTX2Loader(ktx2.detectSupport(renderer));
      try {
        const gltf = await loader.parseAsync(
          format === 'glb' ? await bytes(main) : await text(main),
          '',
        );
        object = gltf.scene;
        animations = gltf.animations;
      } finally {
        draco.dispose();
        ktx2.dispose();
      }
    } else if (format === 'obj') {
      const [{ OBJLoader }, { MTLLoader }] = await Promise.all([
        import('three/addons/loaders/OBJLoader.js'),
        import('three/addons/loaders/MTLLoader.js'),
      ]);
      const loader = new OBJLoader(manager);
      const mtl = files.find((file) => extensionOf(file.name) === 'mtl');
      if (mtl) {
        const materials = new MTLLoader(manager).parse(await text(mtl), '');
        materials.preload();
        loader.setMaterials(materials);
      }
      object = loader.parse(await text(main));
      if (!mtl) {
        object.traverse((node) => {
          const mesh = node as THREE.Mesh;
          if (mesh.isMesh) mesh.material = plainMaterial(mesh.geometry);
        });
      }
    } else if (format === 'fbx') {
      const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js');
      object = new FBXLoader(manager).parse(await bytes(main), '');
      animations = object.animations;
    } else if (format === 'stl') {
      const { STLLoader } = await import('three/addons/loaders/STLLoader.js');
      object = fromGeometry(new STLLoader().parse(await bytes(main)));
    } else if (format === 'ply') {
      const { PLYLoader } = await import('three/addons/loaders/PLYLoader.js');
      const geometry = new PLYLoader().parse(await bytes(main));
      object = fromGeometry(geometry, geometry.index === null);
    } else if (format === '3mf') {
      const { ThreeMFLoader } = await import('three/addons/loaders/3MFLoader.js');
      object = new ThreeMFLoader(manager).parse(await bytes(main));
    } else if (format === 'dae') {
      const { ColladaLoader } = await import('three/addons/loaders/ColladaLoader.js');
      const collada = new ColladaLoader(manager).parse(await text(main), '');
      if (!collada) throw new Error('Empty Collada file');
      object = collada.scene;
      animations = collada.scene.animations;
    } else if (format === 'usdz') {
      const { USDLoader } = await import('three/addons/loaders/USDLoader.js');
      object = new USDLoader(manager).parse(await bytes(main), '');
    } else {
      const { TDSLoader } = await import('three/addons/loaders/TDSLoader.js');
      object = new TDSLoader(manager).parse(await bytes(main), '');
    }

    if (isPending) {
      await new Promise<void>((resolve) => {
        onSettled = resolve;
        setTimeout(resolve, 15_000);
      });
    }
    return { object, animations, missing: [...missing].sort(), release };
  } catch (error) {
    release();
    // A .gltf without its .bin fails inside the parser; say which files to add instead.
    if (missing.size > 0) throw new MissingFilesError([...missing].sort());
    throw error;
  }
}
