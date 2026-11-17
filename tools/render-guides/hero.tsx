import { useThree } from '@react-three/fiber';
import { ThreeCanvas } from '@remotion/three';
import { Box, Check, ImagePlus } from 'lucide-react';
import { useEffect, useLayoutEffect, useState } from 'react';
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import { Box3, type Group, Mesh, MeshStandardMaterial, PMREMGenerator, Vector3 } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Offline artwork: existing public photo, angle sheet and GLB with presentation lighting. Timing is illustrative.
const C = {
  canvas: '#0A0A0B',
  panel: '#131315',
  text: '#ECEBE7',
  muted: '#909095',
  line: 'rgba(236,235,231,.15)',
};
const ease = (f: number, a: number, b: number, x = 0, y = 1) =>
  interpolate(f, [a, b], [x, y], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
function StudioLight() {
  const { gl, scene } = useThree();
  // Install the environment before Remotion advances its first frame. Otherwise
  // the single-frame poster can capture different lighting from the video.
  useLayoutEffect(() => {
    const room = new RoomEnvironment();
    const generator = new PMREMGenerator(gl);
    const target = generator.fromScene(room);
    scene.environment = target.texture;
    scene.environmentIntensity = 0.35;
    room.dispose();
    generator.dispose();
    return () => {
      scene.environment = null;
      target.dispose();
    };
  }, [gl, scene]);
  return null;
}
export function HeroMotion() {
  const f = useCurrentFrame();
  const [scene, setScene] = useState<Group | null>(null);
  const [handle] = useState(() => delayRender('Load existing table example'));
  useEffect(() => {
    new GLTFLoader().load(
      staticFile('hero-table.glb'),
      ({ scene: loaded }) => {
        // The source uses the glTF metallic default for wood. Presentation-only correction;
        // texture maps and the downloadable public GLB are unchanged.
        loaded.traverse((object) => {
          if (object instanceof Mesh)
            for (const material of Array.isArray(object.material)
              ? object.material
              : [object.material]) {
              if (material instanceof MeshStandardMaterial) {
                material.metalness = 0;
                material.roughness = 0.8;
              }
            }
        });
        const box = new Box3().setFromObject(loaded);
        const size = box.getSize(new Vector3());
        const center = box.getCenter(new Vector3());
        const scale = 2.2 / Math.max(size.x, size.y, size.z);
        loaded.scale.setScalar(scale);
        loaded.position.copy(center.multiplyScalar(-scale));
        setScene(loaded);
        continueRender(handle);
      },
      undefined,
      cancelRender,
    );
  }, [handle]);
  if (!scene) return null;
  const photoFade = 1 - ease(f, 90, 114);
  const sheetFade = ease(f, 90, 114) * (1 - ease(f, 220, 244));
  const modelFade = ease(f, 220, 244) * (1 - ease(f, 405, 419));
  return (
    <AbsoluteFill style={{ background: C.canvas, color: C.text }}>
      <div
        style={{
          position: 'absolute',
          inset: 38,
          border: `1px solid ${C.line}`,
          borderRadius: 24,
          background: C.panel,
        }}
      />
      <div style={{ position: 'absolute', left: 76, top: 70, display: 'flex', gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: 7, height: 7, background: C.muted, borderRadius: '50%' }} />
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 250,
          top: 120,
          width: 500,
          height: 500,
          opacity: photoFade + ease(f, 405, 419),
          transform: `translateY(${ease(f, 0, 35, 18, 0)}px) scale(${ease(f, 0, 35, 0.96, 1)})`,
          borderRadius: 18,
          overflow: 'hidden',
        }}
      >
        <Img
          src={staticFile('hero-photo.jpg')}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 210,
          top: 95,
          width: 580,
          height: 580,
          opacity: sheetFade,
          transform: `scale(${ease(f, 90, 124, 0.92, 1)})`,
          borderRadius: 18,
          overflow: 'hidden',
        }}
      >
        <Img src={staticFile('hero-angles.png')} style={{ width: '100%', height: '100%' }} />
        {/* The review outline visits actual cells of the existing angle sheet. */}
        <div
          style={{
            position: 'absolute',
            left: 193.33 * (Math.min(8, Math.floor(Math.max(0, f - 125) / 10)) % 3),
            top: 193.33 * Math.floor(Math.min(8, Math.floor(Math.max(0, f - 125) / 10)) / 3),
            width: 193.33,
            height: 193.33,
            border: `3px solid ${C.muted}`,
            borderRadius: 10,
            boxSizing: 'border-box',
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 70,
          top: 75,
          width: 860,
          height: 600,
          opacity: modelFade,
        }}
      >
        <ThreeCanvas
          // Preserve texture hues instead of compressing bright wood through ACES.
          flat
          width={860}
          height={600}
          camera={{ position: [0, 1.6, 4.5], fov: 32 }}
          gl={{ alpha: true, antialias: true }}
        >
          <StudioLight />
          <ambientLight intensity={4} />
          <directionalLight intensity={1.4} position={[4, 5, 6]} />
          <directionalLight intensity={0.6} position={[-4, 2, -3]} />
          <group rotation={[0, 0.4 + Math.max(0, f - 240) * 0.014, 0]}>
            <primitive object={scene} />
          </group>
        </ThreeCanvas>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 460,
          top: 690,
          width: 80,
          height: 42,
          border: `1px solid ${C.line}`,
          borderRadius: 24,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {f < 110 || f > 405 ? (
          <ImagePlus size={24} />
        ) : f < 240 ? (
          <Check size={24} />
        ) : (
          <Box size={24} />
        )}
      </div>
    </AbsoluteFill>
  );
}
