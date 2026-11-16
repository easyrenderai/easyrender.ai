import { ThreeCanvas } from '@remotion/three';
import {
  Box,
  Check,
  Code,
  Download,
  FileBox,
  Globe,
  Image,
  Layers,
  MousePointer2,
  ShoppingBag,
  SlidersHorizontal,
  Upload,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  AbsoluteFill,
  Composition,
  cancelRender,
  continueRender,
  delayRender,
  Easing,
  interpolate,
  registerRoot,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import { Box3, type Group, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Offline artwork uses the exact carbon/bone palette from DESIGN.md. No runtime dependency.
const C = {
  background: '#0A0A0B',
  card: '#131315',
  panel: '#1C1C1F',
  text: '#ECEBE7',
  muted: '#909095',
  line: 'rgba(236,235,231,.15)',
  paper: '#F3F2EE',
};
type Journey = 'web' | 'shop' | 'design';
const W = 1200;
const H = 900;
function tween(f: number, start: number, end: number, from = 0, to = 1) {
  return interpolate(f, [start, end], [from, to], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}
function Window({
  name,
  children,
  style,
}: {
  name: string;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 70,
        top: 70,
        width: 1060,
        height: 710,
        border: `1px solid ${C.line}`,
        borderRadius: 26,
        overflow: 'hidden',
        background: C.card,
        boxShadow: '0 30px 70px rgba(0,0,0,.35)',
        ...style,
      }}
    >
      <div
        style={{
          height: 66,
          borderBottom: `1px solid ${C.line}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 30px',
          gap: 10,
        }}
      >
        {[0, 1, 2].map((n) => (
          <span
            key={n}
            style={{ width: 9, height: 9, borderRadius: 10, background: C.muted, opacity: 0.45 }}
          />
        ))}
        <span style={{ marginLeft: 22, fontSize: 25, color: C.text }}>{name}</span>
      </div>
      {children}
    </div>
  );
}
function Model({
  scene,
  x = 290,
  y = 170,
  size = 440,
  rotation = 0,
  isGrid = false,
}: {
  scene: Group;
  x?: number;
  y?: number;
  size?: number;
  rotation?: number;
  isGrid?: boolean;
}) {
  const model = useMemo(() => scene.clone(true), [scene]);
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: size, height: size }}>
      <ThreeCanvas
        width={size}
        height={size}
        camera={{ position: [0, 0.3, 4.8], fov: 34 }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={1.5} />
        <directionalLight position={[4, 5, 6]} intensity={2.6} />
        <directionalLight position={[-4, 1, 3]} intensity={1.3} />
        {isGrid && <gridHelper args={[8, 16, '#909095', '#26262A']} position={[0, -1.05, 0]} />}
        <group rotation={[0, rotation, 0]}>
          <primitive object={model} />
        </group>
      </ThreeCanvas>
    </div>
  );
}
function Cursor({
  f,
  points,
  clicks = [],
}: {
  f: number;
  points: [number, number, number][];
  clicks?: number[];
}) {
  let x = points[0][1];
  let y = points[0][2];
  for (let i = 1; i < points.length; i++) {
    if (f >= points[i - 1][0]) {
      x = tween(f, points[i - 1][0], points[i][0], points[i - 1][1], points[i][1]);
      y = tween(f, points[i - 1][0], points[i][0], points[i - 1][2], points[i][2]);
    }
  }
  const pulse = clicks.reduce((sum, at) => sum + (f >= at && f < at + 16 ? (f - at) / 16 : 0), 0);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        opacity: tween(f, 12, 24),
        filter: 'drop-shadow(0 3px 6px #000)',
      }}
    >
      {pulse > 0 && (
        <div
          style={{
            position: 'absolute',
            left: -30,
            top: -30,
            width: 60,
            height: 60,
            borderRadius: '50%',
            border: `3px solid ${C.text}`,
            opacity: 1 - pulse,
            transform: `scale(${pulse * 1.8})`,
          }}
        />
      )}
      <MousePointer2 size={40} fill={C.text} stroke={C.background} strokeWidth={1.4} />
    </div>
  );
}
function File({
  x,
  y,
  scale = 1,
  opacity = 1,
}: {
  x: number;
  y: number;
  scale?: number;
  opacity?: number;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 210,
        padding: '28px 20px',
        borderRadius: 18,
        border: `1px solid ${C.line}`,
        background: C.panel,
        textAlign: 'center',
        transform: `scale(${scale}) rotate(-5deg)`,
        opacity,
        boxShadow: '0 20px 45px rgba(0,0,0,.4)',
      }}
    >
      <FileBox size={68} strokeWidth={1.2} />
      <div style={{ fontSize: 26, marginTop: 12 }}>vase.glb</div>
    </div>
  );
}
function DownloadScene({ scene, f }: { scene: Group; f: number }) {
  const out = tween(f, 122, 150);
  return (
    <AbsoluteFill
      style={{
        opacity: 1 - out,
        transform: `translateX(${-out * 100}px) scale(${1 - out * 0.06})`,
      }}
    >
      <Window name="easyrender">
        <Model scene={scene} x={310} y={90} size={430} rotation={f * 0.009} />
        <div
          style={{
            position: 'absolute',
            left: 380,
            top: 555,
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            padding: '20px 32px',
            background: C.text,
            color: C.background,
            borderRadius: 12,
            fontSize: 30,
            transform: `scale(${1 - tween(f, 64, 69) * 0.025 + tween(f, 70, 80) * 0.025})`,
          }}
        >
          <Download size={30} /> GLB
        </div>
        <div
          style={{
            position: 'absolute',
            left: 415,
            top: 645,
            opacity: tween(f, 76, 90),
            display: 'flex',
            gap: 12,
            fontSize: 25,
            color: C.muted,
          }}
        >
          <Check size={27} /> vase.glb
        </div>
      </Window>
      <Cursor
        f={f}
        points={[
          [0, 920, 700],
          [35, 720, 670],
          [60, 595, 660],
          [100, 595, 660],
        ]}
        clicks={[66]}
      />
    </AbsoluteFill>
  );
}
function Destination({ journey, scene, f }: { journey: Journey; scene: Group; f: number }) {
  const enter = tween(f, 125, 155);
  const loaded = tween(f, 255, 280);
  const result = tween(f, 355, 390);
  const names = { web: 'modelviewer.dev/editor', shop: 'Shopify', design: 'Blender' };
  return (
    <AbsoluteFill style={{ opacity: enter, transform: `translateX(${(1 - enter) * 100}px)` }}>
      <Window name={names[journey]}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 67,
            bottom: 0,
            width: 110,
            borderRight: `1px solid ${C.line}`,
            display: 'flex',
            alignItems: 'center',
            flexDirection: 'column',
            gap: 40,
            paddingTop: 40,
          }}
        >
          {journey === 'shop' ? (
            <ShoppingBag size={34} />
          ) : journey === 'web' ? (
            <Globe size={34} />
          ) : (
            <Box size={34} />
          )}
          <Layers size={28} color={C.muted} />
          <Image size={28} color={C.muted} />
          <SlidersHorizontal size={28} color={C.muted} />
        </div>
        <div
          style={{
            position: 'absolute',
            left: 155,
            top: 104,
            width: 500,
            height: 478,
            border: `2px dashed ${C.line}`,
            borderRadius: 16,
            opacity: 1 - loaded,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Upload size={72} strokeWidth={1} />
        </div>
        <div style={{ position: 'absolute', left: 710, top: 120, width: 290 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 28 }}>
            <FileBox size={30} /> vase.glb
          </div>
          {[0, 1, 2].map((n) => (
            <div
              key={n}
              style={{
                marginTop: 40,
                height: 9,
                background: C.panel,
                borderRadius: 8,
                width: 240 - n * 25,
              }}
            >
              <div
                style={{
                  width: `${tween(f, 290 + n * 10, 340 + n * 10, 20, 60 + n * 12)}%`,
                  height: 9,
                  borderRadius: 8,
                  background: C.muted,
                }}
              />
            </div>
          ))}
          <div
            style={{
              marginTop: 68,
              padding: 21,
              background: C.text,
              color: C.background,
              borderRadius: 12,
              display: 'flex',
              justifyContent: 'center',
              gap: 14,
              opacity: loaded,
            }}
          >
            {journey === 'web' ? (
              <Code size={34} />
            ) : journey === 'shop' ? (
              <Image size={34} />
            ) : (
              <SlidersHorizontal size={34} />
            )}
            <Check size={34} />
          </div>
        </div>
        {loaded > 0 && (
          <div style={{ opacity: loaded }}>
            <Model
              scene={scene}
              x={145}
              y={100}
              size={510}
              rotation={(f - 270) * 0.009}
              isGrid={journey === 'design'}
            />
          </div>
        )}
      </Window>
      <File
        x={tween(f, 178, 240, 30, 380)}
        y={tween(f, 178, 208, 475, 245) + tween(f, 208, 240, 0, 85)}
        scale={tween(f, 230, 270, 1, 0.55)}
        opacity={tween(f, 145, 165) * (1 - tween(f, 245, 270))}
      />
      <Cursor
        f={f - 135}
        points={[
          [0, 155, 610],
          [35, 155, 610],
          [70, 355, 420],
          [108, 500, 480],
          [160, 920, 510],
          [205, 920, 510],
        ]}
        clicks={[115, 210]}
      />
      <div
        style={{
          opacity: result,
          position: 'absolute',
          inset: 0,
          background: C.background,
          pointerEvents: 'none',
        }}
      >
        {journey === 'web' && (
          <Window name="<model-viewer>">
            <div
              style={{
                position: 'absolute',
                left: 42,
                top: 110,
                width: 380,
                fontSize: 31,
                lineHeight: 1.7,
                fontFamily: 'monospace',
                opacity: 1 - tween(f, 410, 435),
              }}
            >
              {'<model-viewer'}
              <br />
              {'  src="vase.glb"'}
              <br />
              {'  camera-controls'}
              <br />
              {'/>'}
            </div>
            <div
              style={{
                position: 'absolute',
                left: 48,
                top: 130,
                opacity: tween(f, 410, 435),
                width: 350,
              }}
            >
              <Globe size={50} />
              <div
                style={{
                  height: 24,
                  width: 260,
                  background: C.text,
                  borderRadius: 6,
                  marginTop: 35,
                }}
              />
              <div
                style={{
                  height: 10,
                  width: 320,
                  background: C.muted,
                  borderRadius: 6,
                  marginTop: 30,
                }}
              />
              <div
                style={{
                  height: 10,
                  width: 270,
                  background: C.muted,
                  borderRadius: 6,
                  marginTop: 15,
                }}
              />
              <div style={{ marginTop: 55, display: 'flex', gap: 14 }}>
                <Box size={36} />
                <MousePointer2 size={36} />
              </div>
            </div>
            <Model scene={scene} x={430} y={100} size={580} rotation={(f - 355) * 0.012} />
          </Window>
        )}
        {journey === 'shop' && (
          <Window name="Shopify">
            <div
              style={{
                position: 'absolute',
                left: 40,
                top: 110,
                width: 590,
                height: 530,
                background: C.paper,
                borderRadius: 16,
              }}
            />
            <Model scene={scene} x={70} y={115} size={540} rotation={(f - 355) * 0.012} />
            <div style={{ position: 'absolute', left: 690, top: 180 }}>
              <ShoppingBag size={48} />
              <div
                style={{
                  width: 255,
                  height: 24,
                  background: C.text,
                  marginTop: 36,
                  borderRadius: 5,
                }}
              />
              <div
                style={{
                  width: 195,
                  height: 10,
                  background: C.muted,
                  marginTop: 25,
                  borderRadius: 5,
                }}
              />
              <div
                style={{
                  border: `1px solid ${C.line}`,
                  padding: 20,
                  width: 255,
                  marginTop: 70,
                  display: 'flex',
                  gap: 18,
                  borderRadius: 12,
                  fontSize: 30,
                }}
              >
                <Box size={38} /> 3D
              </div>
            </div>
          </Window>
        )}
        {journey === 'design' && (
          <Window name="Blender">
            <Model scene={scene} x={150} y={65} size={650} rotation={(f - 355) * 0.013} isGrid />
            <div
              style={{
                position: 'absolute',
                right: 40,
                top: 145,
                display: 'flex',
                flexDirection: 'column',
                gap: 40,
              }}
            >
              <Layers size={32} />
              <SlidersHorizontal size={32} />
              <Box size={32} />
            </div>
          </Window>
        )}
      </div>
    </AbsoluteFill>
  );
}
function Guide({ journey }: { journey: Journey }) {
  const f = useCurrentFrame();
  const [scene, setScene] = useState<Group | null>(null);
  const [handle] = useState(() => delayRender('Loading the real vase model'));
  useEffect(() => {
    new GLTFLoader().load(
      staticFile('vase.glb'),
      ({ scene: loaded }) => {
        const box = new Box3().setFromObject(loaded);
        const size = box.getSize(new Vector3());
        const center = box.getCenter(new Vector3());
        const scale = 2.1 / Math.max(size.x, size.y, size.z);
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
  return (
    <AbsoluteFill
      style={{ background: C.background, color: C.text, fontFamily: 'Geist, sans-serif' }}
    >
      <style>{`@font-face{font-family:Geist;src:url('${staticFile('geist.woff2')}') format('woff2');font-weight:100 900}`}</style>
      {f < 151 ? <DownloadScene scene={scene} f={f} /> : null}
      {f >= 125 ? <Destination scene={scene} journey={journey} f={f} /> : null}
      <div
        style={{ position: 'absolute', left: 80, right: 80, bottom: 58, display: 'flex', gap: 10 }}
      >
        {[0, 1, 2].map((n) => (
          <div key={n} style={{ flex: 1, height: 3, background: C.panel }}>
            <div
              style={{
                width: `${tween(f, [0, 150, 360][n], [150, 360, 539][n]) * 100}%`,
                height: 3,
                background: C.text,
              }}
            />
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}
function Root() {
  return (
    <>
      {(['web', 'shop', 'design'] as const).map((journey) => (
        <Composition
          key={journey}
          id={journey}
          component={Guide}
          defaultProps={{ journey }}
          width={W}
          height={H}
          fps={30}
          durationInFrames={540}
        />
      ))}
    </>
  );
}
registerRoot(Root);
