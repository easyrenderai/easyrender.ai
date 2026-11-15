import {
  Box,
  Camera,
  Download,
  Eye,
  Images,
  LayoutGrid,
  Ruler,
  ScanSearch,
  Sparkles,
  Undo2,
} from 'lucide-react';
import { defineDiagram, FlowArrow, Heading, Node, Tag } from './kit';

// Guide: how-to-make-a-3d-model-from-photos.

/** Photogrammetry measures every side; image-to-3D works from one photo, so unseen sides come from that picture. */
export const photoVsPhotogrammetry = defineDiagram(
  {
    en: {
      lanes: [
        {
          heading: 'Photogrammetry',
          input: 'The object in front of you',
          steps: [
            { title: '20 to 100+ overlapping photos', note: 'Taken all the way round it' },
            { title: 'Software matches points between photos', note: 'Each surface from 2+ shots' },
            { title: 'Every surface was seen', note: 'Real detail, if the camera reached it' },
          ],
        },
        {
          heading: 'Image-to-3D',
          input: 'One photo, even a supplier’s',
          steps: [
            { title: '1 photo of one side', note: 'Sharp, plain background' },
            {
              title: 'Sides not in the photo come from it',
              note: 'Check those sides in the preview',
            },
            { title: 'Check the back in the preview', note: 'The photo did not show that side' },
          ],
        },
      ],
      needs: 'Needs',
    },
    fr: {
      lanes: [
        {
          heading: 'Photogrammétrie',
          input: 'L’objet devant toi',
          steps: [
            { title: '20 à plus de 100 photos qui se chevauchent', note: 'Prises tout autour' },
            {
              title: 'Le logiciel relie les points entre photos',
              note: 'Chaque surface vue sur 2 prises ou plus',
            },
            { title: 'Chaque surface a été vue', note: 'Vrai détail, là où l’appareil est passé' },
          ],
        },
        {
          heading: 'Image vers 3D',
          input: 'Une photo, même celle d’un fournisseur',
          steps: [
            { title: '1 photo d’un côté', note: 'Nette, fond uni' },
            {
              title: 'Les faces absentes sont déduites de la photo',
              note: 'Contrôle-les dans l’aperçu',
            },
            { title: 'Contrôle l’arrière dans l’aperçu', note: 'La photo ne montrait pas ce côté' },
          ],
        },
      ],
      needs: 'Il faut',
    },
    it: {
      lanes: [
        {
          heading: 'Fotogrammetria',
          input: 'L’oggetto davanti a te',
          steps: [
            { title: 'Da 20 a oltre 100 foto sovrapposte', note: 'Scattate tutto intorno' },
            {
              title: 'Il software unisce i punti tra le foto',
              note: 'Ogni superficie da 2 scatti o più',
            },
            {
              title: 'Ogni superficie è stata vista',
              note: 'Dettaglio reale, dove è passata la fotocamera',
            },
          ],
        },
        {
          heading: 'Da immagine a 3D',
          input: 'Una foto, anche quella del fornitore',
          steps: [
            { title: '1 foto di un lato', note: 'Nitida, sfondo uniforme' },
            {
              title: 'I lati assenti si deducono dalla foto',
              note: 'Controllali nell’anteprima',
            },
            {
              title: 'Controlla il retro nell’anteprima',
              note: 'La foto non mostrava quel lato',
            },
          ],
        },
      ],
      needs: 'Serve',
    },
  },
  function PhotoVsPhotogrammetry({ t }) {
    const icons = [
      [Images, ScanSearch, Ruler],
      [Camera, Sparkles, Eye],
    ] as const;
    return (
      <div className="grid gap-6 sm:grid-cols-2 sm:gap-4">
        {t.lanes.map((lane, column) => (
          <div key={lane.heading} className="flex flex-col gap-2">
            <Heading>{lane.heading}</Heading>
            <p className="text-xs text-muted-foreground">
              {t.needs}: <span className="text-foreground">{lane.input}</span>
            </p>
            {lane.steps.map((step, row) => (
              <div key={step.title} className="contents">
                {row > 0 && <FlowArrow />}
                <Node
                  icon={icons[column]?.[row]}
                  title={step.title}
                  note={step.note}
                  isStrong={row === lane.steps.length - 1}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  },
);

/** The two stages: a preview of every angle first, the model only once the preview is right. */
export const imageTo3dPipeline = defineDiagram(
  {
    en: {
      steps: [
        { tag: '1', title: 'One photo', note: 'The whole object, three-quarter angle' },
        { tag: '2', title: 'Angle sheet', note: 'The object drawn from several sides' },
        {
          tag: '3',
          title: 'You check it',
          note: 'Back, sides and top, which the photo did not show',
        },
        { tag: '4', title: 'Build the model', note: 'Textured mesh from those views' },
        { tag: '5', title: 'GLB and USDZ', note: 'Web and Android, iPhone and iPad' },
      ],
      preview: 'Preview',
      build: 'Model',
      loop: 'Looks wrong at step 3: change the photo, not the settings.',
    },
    fr: {
      steps: [
        { tag: '1', title: 'Une photo', note: 'L’objet entier, de trois-quarts' },
        { tag: '2', title: 'Planche de vues', note: 'L’objet dessiné sous plusieurs côtés' },
        {
          tag: '3',
          title: 'Tu la contrôles',
          note: 'Arrière, côtés et dessus, absents de la photo',
        },
        { tag: '4', title: 'Construction du modèle', note: 'Maillage texturé tiré de ces vues' },
        { tag: '5', title: 'GLB et USDZ', note: 'Web et Android, iPhone et iPad' },
      ],
      preview: 'Aperçu',
      build: 'Modèle',
      loop: 'Erreur à l’étape 3 : change la photo, pas les réglages.',
    },
    it: {
      steps: [
        { tag: '1', title: 'Una foto', note: 'L’oggetto intero, di tre quarti' },
        { tag: '2', title: 'Tavola delle angolazioni', note: 'L’oggetto disegnato da più lati' },
        {
          tag: '3',
          title: 'La controlli tu',
          note: 'Retro, lati e sopra, assenti dalla foto',
        },
        {
          tag: '4',
          title: 'Costruzione del modello',
          note: 'Mesh con texture ricavata da quelle viste',
        },
        { tag: '5', title: 'GLB e USDZ', note: 'Web e Android, iPhone e iPad' },
      ],
      preview: 'Anteprima',
      build: 'Modello',
      loop: 'Errore al passo 3: cambia la foto, non le impostazioni.',
    },
  },
  function ImageTo3dPipeline({ t }) {
    const icons = [Camera, LayoutGrid, Eye, Box, Download];
    return (
      <div className="space-y-3">
        <div className="flex flex-col gap-2">
          {[
            { label: t.preview, steps: t.steps.slice(0, 3), offset: 0 },
            { label: t.build, steps: t.steps.slice(3), offset: 3 },
          ].map((group, groupIndex) => (
            <div key={group.label} className="contents">
              {groupIndex > 0 && <FlowArrow />}
              <div className="rounded-md border border-dashed p-2">
                <Heading>{group.label}</Heading>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  {group.steps.map((step, index) => (
                    <div key={step.tag} className="contents">
                      {index > 0 && <FlowArrow isRow />}
                      <Node
                        className="min-w-0 flex-1"
                        icon={icons[group.offset + index]}
                        title={
                          <>
                            <Tag className="mr-1.5">{step.tag}</Tag>
                            {step.title}
                          </>
                        }
                        note={step.note}
                        isStrong={group.offset + index === 2}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Undo2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t.loop}
        </p>
      </div>
    );
  },
);
