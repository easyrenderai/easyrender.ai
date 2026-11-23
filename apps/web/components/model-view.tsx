'use client';

import { Download, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { MaterialPanel } from '@/components/material-panel';
import { ModelViewer } from '@/components/model-viewer';
import { RenderNextSteps } from '@/components/render-next-steps';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { captureBrowser } from '@/lib/analytics/browser';

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
  const response = await fetch(glbUrl);
  if (!response.ok) throw new Error('Model file is unavailable');
  const data = await response.arrayBuffer();
  const gltf = await new GLTFLoader().parseAsync(data, '');
  const bytes = await new USDZExporter().parseAsync(gltf.scene);
  return new Blob([bytes as BlobPart], { type: 'model/vnd.usdz+zip' });
}

// OBJ, FBX and BLEND are converted on the server, one file per click.
const EXPORT_FORMATS = ['obj', 'fbx', 'blend'] as const;
type ExportFormat = (typeof EXPORT_FORMATS)[number];

// The interactive 3D viewer with AR, plus the downloads the owner is allowed.
export function ModelView({
  src,
  name,
  downloadUrl,
  exportsUrl,
  editableRenderId,
  nextStepsHref,
}: {
  src: string;
  name: string;
  downloadUrl?: string | null;
  /** Set for the owner when the deployment can convert: adds OBJ, FBX and BLEND downloads. */
  exportsUrl?: string | null;
  /** Set for the owner of a finished render: shows the material controls under the viewer. */
  editableRenderId?: string;
  /** Only the owner of a finished render gets the usage walkthrough. */
  nextStepsHref?: string;
}) {
  const t = useTranslations('Render');
  const [exporting, setExporting] = useState(false);
  const [converting, setConverting] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState<'usdz' | 'converted' | null>(null);
  const [viewer, setViewer] = useState<HTMLElement | null>(null);

  async function exportAs(format: ExportFormat) {
    if (!exportsUrl) return;
    setConverting(format);
    setExportError(null);
    try {
      const response = await fetch(exportsUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ format }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || typeof data?.url !== 'string') throw new Error('export failed');
      captureBrowser('model_exported', { format });
      // The link answers with a download, so the page stays where it is.
      window.location.assign(data.url);
    } catch {
      setExportError('converted');
    } finally {
      setConverting(null);
    }
  }

  const downloads = downloadUrl ? (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button variant={nextStepsHref ? 'default' : 'outline'} size="sm" asChild>
          <a
            href={downloadUrl}
            download
            onClick={() => captureBrowser('model_download_requested', { format: 'glb' })}
          >
            <Download />
            {t('downloadGlb')}
          </a>
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={exporting || converting !== null}
          aria-busy={exporting}
          onClick={async () => {
            setExporting(true);
            setExportError(null);
            try {
              // From the full model, not the lighter copy the viewer shows.
              save(await exportUsdz(downloadUrl), `easyrender-${name}.usdz`);
              captureBrowser('model_exported', { format: 'usdz' });
            } catch {
              setExportError('usdz');
            } finally {
              setExporting(false);
            }
          }}
        >
          {exporting ? <Loader2 className="animate-spin" /> : <Download />}
          {t('downloadUsdz')}
        </Button>
        {exportsUrl &&
          EXPORT_FORMATS.map((format) => (
            <Button
              key={format}
              variant="outline"
              size="sm"
              disabled={exporting || converting !== null}
              aria-busy={converting === format}
              onClick={() => exportAs(format)}
            >
              {converting === format ? <Loader2 className="animate-spin" /> : <Download />}
              {format.toUpperCase()}
            </Button>
          ))}
      </div>
      {exportError && (
        <p role="alert" className="text-sm text-destructive">
          {t(exportError === 'usdz' ? 'errors.usdz' : 'errors.export')}
        </p>
      )}
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      {/* A fixed height, not the whole column: the downloads below stay on the first screen. */}
      <div className="h-[clamp(18rem,60svh,34rem)] w-full overflow-hidden rounded-xl border bg-gradient-to-b from-muted/30 to-muted">
        <ModelViewer
          src={src}
          alt={t('modelAlt', { name })}
          interactive
          ar
          lazy={false}
          onLoad={setViewer}
        />
      </div>
      {downloads}
      {editableRenderId && nextStepsHref ? (
        <Tabs defaultValue="materials" className="gap-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="materials">{t('tabs.materials')}</TabsTrigger>
            <TabsTrigger value="use">{t('tabs.use')}</TabsTrigger>
          </TabsList>
          {/* Kept mounted so an unsaved material edit survives a visit to the other tab. */}
          <TabsContent value="materials" forceMount className="data-[state=inactive]:hidden">
            <MaterialPanel renderId={editableRenderId} viewer={viewer} />
          </TabsContent>
          <TabsContent value="use">
            <RenderNextSteps createHref={nextStepsHref} />
          </TabsContent>
        </Tabs>
      ) : (
        editableRenderId && <MaterialPanel renderId={editableRenderId} viewer={viewer} />
      )}
    </div>
  );
}
