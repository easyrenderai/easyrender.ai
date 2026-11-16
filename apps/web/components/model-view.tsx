'use client';

import { Download, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { MaterialPanel } from '@/components/material-panel';
import { ModelViewer } from '@/components/model-viewer';
import { RenderNextSteps } from '@/components/render-next-steps';
import { Button } from '@/components/ui/button';

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// USDZ (for iOS Quick Look) is converted in the browser from the GLB, so we only store one file.
async function exportUsdz(glbUrl: string): Promise<Blob> {
  const [{ GLTFLoader }, { USDZExporter }] = await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/exporters/USDZExporter.js'),
  ]);
  const data = await (await fetch(glbUrl)).arrayBuffer();
  const gltf = await new GLTFLoader().parseAsync(data, '');
  const bytes = await new USDZExporter().parseAsync(gltf.scene);
  return new Blob([bytes as BlobPart], { type: 'model/vnd.usdz+zip' });
}

// The interactive 3D viewer with AR, plus GLB and USDZ downloads when allowed.
export function ModelView({
  src,
  name,
  downloadUrl,
  editableRenderId,
  nextStepsHref,
}: {
  src: string;
  name: string;
  downloadUrl?: string | null;
  /** Set for the owner of a finished render: shows the material controls under the viewer. */
  editableRenderId?: string;
  /** Only the owner of a finished render gets the usage walkthrough. */
  nextStepsHref?: string;
}) {
  const t = useTranslations('Render');
  const [exporting, setExporting] = useState(false);
  const [viewer, setViewer] = useState<HTMLElement | null>(null);

  const downloads = downloadUrl ? (
    <div className="flex flex-wrap gap-2">
      <Button variant={nextStepsHref ? 'default' : 'outline'} size="sm" asChild>
        <a href={downloadUrl} download>
          <Download />
          GLB
        </a>
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={exporting}
        onClick={async () => {
          setExporting(true);
          try {
            save(await exportUsdz(src), `easyrender-${name}.usdz`);
          } finally {
            setExporting(false);
          }
        }}
      >
        {exporting ? <Loader2 className="animate-spin" /> : <Download />}
        USDZ
      </Button>
    </div>
  ) : null;

  return (
    <div className="space-y-3">
      <div className="aspect-square w-full overflow-hidden rounded-xl border bg-gradient-to-b from-muted/30 to-muted sm:aspect-[4/3]">
        <ModelViewer
          src={src}
          alt={t('modelAlt', { name })}
          interactive
          ar
          lazy={false}
          onLoad={setViewer}
        />
      </div>
      {nextStepsHref && downloads ? (
        <RenderNextSteps downloads={downloads} createHref={nextStepsHref} />
      ) : (
        downloads
      )}
      {editableRenderId && <MaterialPanel renderId={editableRenderId} viewer={viewer} />}
    </div>
  );
}
