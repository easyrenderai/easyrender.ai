import * as THREE from 'three';

export type ModelStats = {
  meshes: number;
  triangles: number;
  vertices: number;
  materials: number;
  textures: number;
  /** Width, height and depth of the bounding box, in the file's own units. */
  size: [number, number, number];
};

type Drawable = THREE.Mesh | THREE.Points | THREE.Line;

const isDrawable = (node: THREE.Object3D): node is Drawable =>
  (node as THREE.Mesh).isMesh || (node as THREE.Points).isPoints || (node as THREE.Line).isLine;

/** Every material under an object, once each. */
export function materialsOf(object: THREE.Object3D): THREE.Material[] {
  const materials = new Set<THREE.Material>();
  object.traverse((node) => {
    if (!isDrawable(node)) return;
    for (const material of [node.material].flat()) materials.add(material);
  });
  return [...materials];
}

/** Every texture those materials use, once each. */
export function texturesOf(materials: readonly THREE.Material[]): THREE.Texture[] {
  const textures = new Set<THREE.Texture>();
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value instanceof THREE.Texture) textures.add(value);
    }
  }
  return [...textures];
}

/** What the model is made of: the numbers shown under the viewer. */
export function describeModel(object: THREE.Object3D): ModelStats {
  let meshes = 0;
  let triangles = 0;
  let vertices = 0;
  object.traverse((node) => {
    if (!isDrawable(node)) return;
    const position = node.geometry.getAttribute('position');
    if (!position) return;
    vertices += position.count;
    if (!(node as THREE.Mesh).isMesh) return;
    meshes += 1;
    const count = node.geometry.index ? node.geometry.index.count : position.count;
    const instances = (node as THREE.InstancedMesh).isInstancedMesh
      ? (node as THREE.InstancedMesh).count
      : 1;
    triangles += Math.floor(count / 3) * instances;
  });
  const materials = materialsOf(object);
  object.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.isEmpty() ? new THREE.Vector3() : box.getSize(new THREE.Vector3());
  return {
    meshes,
    triangles,
    vertices,
    materials: materials.length,
    textures: texturesOf(materials).length,
    size: [size.x, size.y, size.z],
  };
}
