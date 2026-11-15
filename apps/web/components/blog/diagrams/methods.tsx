import { Camera, CircleHelp, type LucideIcon, PenTool, ScanLine, Sparkles } from 'lucide-react';
import { Drawing, defineDiagram, FlowArrow, Label, LINE, Node, SHAPE, SOFT, Tag } from './kit';

// Guide: how-to-make-a-3d-model (the core guide).

/** Which of the five methods fits, from three questions about the object. */
export const methodDecisionTree = defineDiagram(
  {
    en: {
      questions: [
        'Does the object exist yet?',
        'Is it in front of you?',
        'Large and simple, or detailed?',
      ],
      no: 'No',
      yes: 'Yes',
      onlyPhoto: 'No, only a photo',
      large: 'Large, simple',
      detailed: 'Detailed surface',
      methods: {
        software: { title: 'Model it in software', note: 'Or hire a 3D artist' },
        ai: { title: 'AI from one photo', note: 'Check the back. An artist, if it must be exact' },
        lidar: { title: 'LiDAR on a phone', note: 'A sofa, a cabinet' },
        photogrammetry: { title: 'Photogrammetry', note: '20 to 100+ photos' },
      },
    },
    de: {
      questions: [
        'Gibt es das Objekt schon?',
        'Steht es vor dir?',
        'Groß und einfach, oder detailliert?',
      ],
      no: 'Nein',
      yes: 'Ja',
      onlyPhoto: 'Nein, nur ein Foto',
      large: 'Groß, einfach',
      detailed: 'Detaillierte Fläche',
      methods: {
        software: { title: 'Im Programm modellieren', note: 'Oder eine 3D-Fachkraft beauftragen' },
        ai: {
          title: 'KI aus einem Foto',
          note: 'Prüfe die Rückseite. Eine Fachkraft, wenn es exakt sein muss',
        },
        lidar: { title: 'LiDAR am Handy', note: 'Ein Sofa, ein Schrank' },
        photogrammetry: { title: 'Photogrammetrie', note: '20 bis über 100 Fotos' },
      },
    },
  },
  function MethodDecisionTree({ t }) {
    // A ladder: each question has one answer that ends at a method (left) and one that leads on
    // to the next question (right), until the last question splits into two methods.
    const exit = (answer: string, method: { title: string; note: string }, icon: LucideIcon) => (
      <div className="flex flex-col gap-1.5">
        <Tag className="self-start">{answer}</Tag>
        <Node icon={icon} title={method.title} note={method.note} className="flex-1" />
      </div>
    );
    const next = (
      <div className="flex flex-col gap-1.5">
        <Tag className="self-start">{t.yes}</Tag>
        <div className="flex flex-1 items-center justify-center rounded-md border border-dashed py-2">
          <FlowArrow />
        </div>
      </div>
    );
    const question = (text: string) => <Node icon={CircleHelp} title={text} isStrong />;
    return (
      <div className="space-y-3">
        {question(t.questions[0] as string)}
        <div className="grid grid-cols-2 gap-2">
          {exit(t.no, t.methods.software, PenTool)}
          {next}
        </div>
        {question(t.questions[1] as string)}
        <div className="grid grid-cols-2 gap-2">
          {exit(t.onlyPhoto, t.methods.ai, Sparkles)}
          {next}
        </div>
        {question(t.questions[2] as string)}
        <div className="grid grid-cols-2 gap-2">
          {exit(t.large, t.methods.lidar, ScanLine)}
          {exit(t.detailed, t.methods.photogrammetry, Camera)}
        </div>
      </div>
    );
  },
);

// Ten camera positions round each ring, every 36 degrees.
const CAMERA_ANGLES = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324];

/** Photogrammetry capture: rings of photos at three heights, each shot overlapping the next. */
export const photogrammetryRings = defineDiagram(
  {
    en: {
      rings: ['High', 'Middle', 'Low'],
      overlap: ['Next photo: about 70%', 'of the view is shared'],
    },
    de: {
      rings: ['Oben', 'Mitte', 'Unten'],
      overlap: ['Nächstes Foto: etwa 70 %', 'der Ansicht überlappen sich'],
    },
  },
  function PhotogrammetryRings({ t }) {
    const rings = [
      { y: 70, rx: 130, ry: 28 },
      { y: 170, rx: 170, ry: 38 },
      { y: 262, rx: 150, ry: 32 },
    ];
    const cx = 190;
    return (
      <Drawing viewBox="0 0 560 420">
        {/* The object: a floor lamp, shade and stem. */}
        <path d="M160 96 L220 96 L236 150 L144 150 Z" className={SHAPE} strokeWidth={2} />
        <line x1={cx} y1={150} x2={cx} y2={280} className={LINE} strokeWidth={3} />
        <ellipse cx={cx} cy={284} rx={28} ry={7} className={SHAPE} strokeWidth={2} />
        {rings.map((ring, index) => (
          <g key={ring.y}>
            <ellipse
              cx={cx}
              cy={ring.y}
              rx={ring.rx}
              ry={ring.ry}
              className={SOFT}
              strokeWidth={2}
              strokeDasharray="4 6"
            />
            {/* Camera positions along the ring. */}
            {CAMERA_ANGLES.map((degrees) => {
              const angle = (degrees / 180) * Math.PI;
              const x = cx + ring.rx * Math.cos(angle);
              const y = ring.y + ring.ry * Math.sin(angle);
              return (
                <rect
                  key={degrees}
                  x={x - 8}
                  y={y - 6}
                  width={16}
                  height={12}
                  rx={2}
                  className={
                    Math.sin(angle) > 0 ? SHAPE : 'fill-background stroke-muted-foreground'
                  }
                  strokeWidth={1.5}
                />
              );
            })}
            <Label x={cx + ring.rx + 22} y={ring.y + 8}>
              {t.rings[index]}
            </Label>
          </g>
        ))}
        {/* Two neighbouring photos as frames, overlapping by about 70 percent. */}
        <rect x={40} y={334} width={120} height={72} rx={4} className={SOFT} strokeWidth={2} />
        <rect x={76} y={334} width={120} height={72} rx={4} className={SOFT} strokeWidth={2} />
        <rect x={76} y={334} width={84} height={72} className="fill-foreground/10" />
        <Label x={220} y={364}>
          {t.overlap[0]}
        </Label>
        <Label x={220} y={392} isMuted fontSize={22}>
          {t.overlap[1]}
        </Label>
      </Drawing>
    );
  },
);

/** A side table modelled by a beginner: primitives, then bevels, then materials and export. */
export const blockoutSideTable = defineDiagram(
  {
    en: {
      stages: [
        ['Block out', 'boxes, cylinders'],
        ['Bevel', 'the edges'],
        ['Materials,', 'export GLB'],
      ],
    },
    de: {
      stages: [
        ['Blockout', 'Kästen, Zylinder'],
        ['Kanten', 'abrunden'],
        ['Materialien,', 'GLB exportieren'],
      ],
    },
  },
  function BlockoutSideTable({ t }) {
    // The same table in each panel: a top slab and four legs, drawn in a simple oblique view.
    const table = (x: number, radius: number, isTextured: boolean) => (
      <g transform={`translate(${x} 0)`}>
        <path
          d="M20 70 L120 70 L150 46 L50 46 Z"
          className="fill-background stroke-foreground"
          strokeWidth={2}
          strokeLinejoin={radius ? 'round' : 'miter'}
        />
        <rect x={20} y={70} width={100} height={14} rx={radius} className={SHAPE} strokeWidth={2} />
        <path
          d="M120 70 L150 46 L150 60 L120 84 Z"
          className={SHAPE}
          strokeWidth={2}
          strokeLinejoin={radius ? 'round' : 'miter'}
        />
        {[30, 104].map((legX) => (
          <rect
            key={legX}
            x={legX}
            y={84}
            width={8}
            height={70}
            rx={radius ? 4 : 0}
            className={SHAPE}
            strokeWidth={2}
          />
        ))}
        <rect
          x={136}
          y={60}
          width={7}
          height={76}
          rx={radius ? 3.5 : 0}
          className={SHAPE}
          strokeWidth={2}
        />
        {isTextured &&
          [52, 60, 66].map((y, index) => (
            <path
              key={y}
              d={`M${44 + index * 12} ${y} q 30 -4 66 0`}
              className={SOFT}
              strokeWidth={1.5}
            />
          ))}
      </g>
    );
    return (
      <Drawing viewBox="0 0 560 250">
        {t.stages.map((stage, index) => {
          const x = index * 188;
          return (
            <g key={stage[0]}>
              {table(x + 8, index === 0 ? 0 : 5, index === 2)}
              {index === 0 && (
                <g>
                  {/* Primitive outlines: the parts before they are joined. */}
                  <rect
                    x={22}
                    y={40}
                    width={150}
                    height={52}
                    className={SOFT}
                    strokeWidth={1.5}
                    strokeDasharray="4 5"
                  />
                </g>
              )}
              <Label x={x + 88} y={200} textAnchor="middle" fontWeight={600}>
                {`${index + 1}. ${stage[0]}`}
              </Label>
              <Label x={x + 88} y={228} textAnchor="middle" isMuted>
                {stage[1]}
              </Label>
            </g>
          );
        })}
      </Drawing>
    );
  },
);
