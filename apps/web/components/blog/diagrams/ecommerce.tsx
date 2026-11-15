import { Box, Globe, Smartphone, Tablet } from 'lucide-react';
import { Drawing, defineDiagram, FlowArrow, Label, LINE, Node, SHAPE, SOFT, Tag } from './kit';

// Guide: 3d-models-for-ecommerce.

/** One product model, two files, and where a shopper opens each one. */
export const storeFiles = defineDiagram(
  {
    en: {
      model: 'One product model',
      files: [
        {
          name: 'GLB',
          places: [
            { title: 'Product page, any browser', note: 'In a viewer such as model-viewer' },
            { title: 'AR on Android', note: 'Google Scene Viewer' },
          ],
        },
        {
          name: 'USDZ',
          places: [{ title: 'AR on iPhone and iPad', note: 'Apple AR Quick Look' }],
        },
      ],
      shopify: 'Shopify takes both files as product media.',
    },
    de: {
      model: 'Ein Produktmodell',
      files: [
        {
          name: 'GLB',
          places: [
            { title: 'Produktseite, jeder Browser', note: 'In einem Viewer wie model-viewer' },
            { title: 'AR auf Android', note: 'Google Scene Viewer' },
          ],
        },
        {
          name: 'USDZ',
          places: [{ title: 'AR auf iPhone und iPad', note: 'Apple AR Quick Look' }],
        },
      ],
      shopify: 'Shopify nimmt beide Dateien als Produktmedien.',
    },
    fr: {
      model: 'Un modèle produit',
      files: [
        {
          name: 'GLB',
          places: [
            {
              title: 'Fiche produit, tout navigateur',
              note: 'Dans une visionneuse comme model-viewer',
            },
            { title: 'AR sur Android', note: 'Google Scene Viewer' },
          ],
        },
        {
          name: 'USDZ',
          places: [{ title: 'AR sur iPhone et iPad', note: 'Apple AR Quick Look' }],
        },
      ],
      shopify: 'Shopify accepte les deux fichiers comme médias produit.',
    },
  },
  function StoreFiles({ t }) {
    const icons = [[Globe, Smartphone], [Tablet]];
    return (
      <div className="space-y-2">
        <Node icon={Box} title={t.model} isStrong className="mx-auto max-w-xs text-center" />
        <FlowArrow />
        <div className="grid gap-4 sm:grid-cols-2">
          {t.files.map((file, column) => (
            <div
              key={file.name}
              className="flex flex-col gap-2 rounded-md border border-dashed p-2"
            >
              <Tag className="self-start text-foreground">{file.name}</Tag>
              {file.places.map((place, row) => (
                <Node
                  key={place.title}
                  icon={icons[column]?.[row]}
                  title={place.title}
                  note={place.note}
                />
              ))}
            </div>
          ))}
        </div>
        <p className="pt-1 text-xs text-muted-foreground">{t.shopify}</p>
      </div>
    );
  },
);

/** Three supplier photos of one sideboard, and why the three-quarter one is the input. */
export const sideboardPhotoPick = defineDiagram(
  {
    en: {
      shots: [
        { title: 'Front', note: ['No depth:', 'none in', 'the photo'] },
        { title: 'Three-quarter', note: ['Front and', 'end panel:', 'use this one'] },
        { title: 'Close-up', note: ['A handle,', 'not the', 'whole piece'] },
      ],
    },
    de: {
      shots: [
        { title: 'Front', note: ['Keine Tiefe', 'auf dem', 'Foto'] },
        { title: 'Dreiviertel', note: ['Front und', 'Seite:', 'nimm dieses'] },
        { title: 'Nah', note: ['Ein Griff,', 'nicht das', 'ganze Stück'] },
      ],
    },
    fr: {
      shots: [
        { title: 'Face', note: ['Aucune', 'profondeur', 'sur la photo'] },
        { title: 'Trois-quarts', note: ['Face et', 'côté :', 'prends celle-ci'] },
        { title: 'Gros plan', note: ['Une poignée,', 'pas le', 'meuble entier'] },
      ],
    },
  },
  function SideboardPhotoPick({ t }) {
    return (
      <Drawing viewBox="0 0 560 320">
        {t.shots.map((shot, index) => {
          const x = 8 + index * 184;
          const isPick = index === 1;
          return (
            <g key={shot.title}>
              {/* The photo frame. */}
              <rect
                x={x}
                y={8}
                width={176}
                height={150}
                rx={8}
                className={
                  isPick
                    ? 'fill-background stroke-foreground'
                    : 'fill-background stroke-muted-foreground'
                }
                strokeWidth={isPick ? 4 : 2}
                strokeDasharray={isPick ? undefined : '6 5'}
              />
              <Label x={x + 88} y={194} textAnchor="middle" fontWeight={600}>
                {shot.title}
              </Label>
              {shot.note.map((line, row) => (
                <Label
                  key={line}
                  x={x + 88}
                  y={226 + row * 28}
                  textAnchor="middle"
                  isMuted
                  fontSize={22}
                >
                  {line}
                </Label>
              ))}
            </g>
          );
        })}
        {/* Front: a flat rectangle, two doors, legs. */}
        <rect x={36} y={52} width={120} height={66} rx={3} className={SHAPE} strokeWidth={2} />
        <line x1={96} y1={52} x2={96} y2={118} className={LINE} strokeWidth={2} />
        <line x1={88} y1={78} x2={88} y2={92} className={LINE} strokeWidth={3} />
        <line x1={104} y1={78} x2={104} y2={92} className={LINE} strokeWidth={3} />
        <line x1={46} y1={118} x2={46} y2={136} className={LINE} strokeWidth={3} />
        <line x1={146} y1={118} x2={146} y2={136} className={LINE} strokeWidth={3} />
        {/* Three-quarter: the front face plus the end panel, which shows the depth. */}
        <path d="M212 62 L300 70 L300 128 L212 122 Z" className={SHAPE} strokeWidth={2} />
        <path
          d="M300 70 L344 56 L344 110 L300 128 Z"
          className="fill-background stroke-foreground"
          strokeWidth={2}
        />
        <path
          d="M212 62 L256 50 L344 56 L300 70 Z"
          className="fill-background stroke-foreground"
          strokeWidth={2}
        />
        <line x1={256} y1={66} x2={256} y2={125} className={LINE} strokeWidth={2} />
        <line x1={218} y1={122} x2={218} y2={140} className={LINE} strokeWidth={3} />
        <line x1={296} y1={128} x2={296} y2={146} className={LINE} strokeWidth={3} />
        <line x1={340} y1={110} x2={340} y2={126} className={LINE} strokeWidth={3} />
        {/* Handle close-up: one bar handle on a sliver of door. */}
        <line x1={420} y1={30} x2={420} y2={140} className={SOFT} strokeWidth={2} />
        <rect x={452} y={46} width={22} height={78} rx={11} className={SHAPE} strokeWidth={2} />
        <line x1={463} y1={58} x2={463} y2={112} className={SOFT} strokeWidth={2} />
      </Drawing>
    );
  },
);
