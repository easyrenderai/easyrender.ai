import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { formatOf, isZUpFormat, pickModelFile, resourceName, VIEWER_FORMATS } from './formats';
import { describeModel } from './stats';

describe('the viewer formats', () => {
  it('reads the format from the extension, whatever its case', () => {
    expect(formatOf('Chair.GLB')).toBe('glb');
    expect(formatOf('part.v2.stl')).toBe('stl');
    expect(formatOf('scene.3mf')).toBe('3mf');
    expect(formatOf('photo.png')).toBeNull();
    expect(formatOf('README')).toBeNull();
  });

  it('picks the model out of a drop that also carries its companion files', () => {
    const drop = [{ name: 'wood.png' }, { name: 'chair.bin' }, { name: 'chair.gltf' }];
    expect(pickModelFile(drop)).toEqual({ file: drop[2], format: 'gltf' });
    const obj = [{ name: 'chair.mtl' }, { name: 'chair.obj' }];
    expect(pickModelFile(obj)).toEqual({ file: obj[1], format: 'obj' });
  });

  it('answers null when nothing dropped is a 3D file', () => {
    expect(pickModelFile([{ name: 'notes.pdf' }, { name: 'wood.png' }])).toBeNull();
    expect(pickModelFile([])).toBeNull();
  });

  it('matches a referenced file by its name alone', () => {
    expect(resourceName('textures/Wood%20Oak.PNG?v=2')).toBe('wood oak.png');
    expect(resourceName('C:\\models\\chair.bin')).toBe('chair.bin');
  });

  it('stands the 3D printing formats upright and leaves glTF alone', () => {
    expect(VIEWER_FORMATS.filter(isZUpFormat)).toEqual(['stl', '3mf', '3ds']);
  });
});

describe('the model stats', () => {
  it('counts what the model is made of and measures it', () => {
    const material = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
    const group = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 0.5), material);
    const twin = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 0.5), material);
    twin.position.x = 2;
    group.add(box, twin);
    expect(describeModel(group)).toEqual({
      meshes: 2,
      triangles: 24,
      vertices: 48,
      materials: 1,
      textures: 1,
      size: [4, 1, 0.5],
    });
  });

  it('counts the points of a cloud without calling them triangles', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(30), 3));
    const stats = describeModel(new THREE.Points(geometry, new THREE.PointsMaterial()));
    expect(stats).toMatchObject({ meshes: 0, triangles: 0, vertices: 10 });
  });
});
