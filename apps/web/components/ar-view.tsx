'use client';

import { Check, Copy, Smartphone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ModelViewer } from '@/components/model-viewer';
import { Button } from '@/components/ui/button';
import { useArDevice } from '@/lib/ar-device';

type ArElement = HTMLElement & { canActivateAR?: boolean; activateAR?: () => Promise<void> };

// The page a shopper lands on after scanning a product's QR code: the model, and one button that
// opens the phone's own AR (Scene Viewer on Android, Quick Look on iPhone). On a computer there is
// no AR, so only the QR code shows, to carry the model to a phone. An iPhone browser that cannot
// open Quick Look (an in-app view, for one) gets a way into Safari instead of a button that fails.
export function ArView({ src, name, qrUrl }: { src: string; name: string; qrUrl: string }) {
  const t = useTranslations('Ar');
  const [viewer, setViewer] = useState<ArElement | null>(null);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const device = useArDevice();

  async function openAr() {
    if (!viewer?.canActivateAR || !viewer.activateAR) {
      setIsUnavailable(true);
      return;
    }
    await viewer.activateAR();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
    } catch {
      setIsCopied(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-6 md:grid-cols-[1fr_18rem] md:py-10">
      <div className="space-y-4">
        <div className="aspect-square w-full overflow-hidden rounded-xl border bg-gradient-to-b from-muted/30 to-muted sm:aspect-[4/3]">
          <ModelViewer
            src={src}
            alt={t('modelAlt', { name })}
            interactive
            ar
            lazy={false}
            onLoad={(element) => setViewer(element as ArElement)}
          />
        </div>
        {device === 'phone' ? (
          <>
            <Button size="lg" className="h-11 w-full" onClick={openAr} disabled={!viewer}>
              <Smartphone />
              {t('viewInRoom')}
            </Button>
            <p className="text-sm text-muted-foreground">
              {isUnavailable ? t('arUnavailable') : t('tapHint')}
            </p>
          </>
        ) : null}
        {device === 'ios-no-ar' ? (
          <div className="space-y-3 rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">{t('openInSafari')}</p>
            <Button variant="outline" size="lg" className="h-11 w-full" onClick={copyLink}>
              {isCopied ? <Check /> : <Copy />}
              {isCopied ? t('linkCopied') : t('copyLink')}
            </Button>
          </div>
        ) : null}
      </div>
      {device === 'desktop' ? (
        <div className="flex flex-col items-center gap-3 self-start rounded-xl border p-4 text-center">
          <h2 className="text-sm font-medium">{t('scanTitle')}</h2>
          {/* biome-ignore lint/performance/noImgElement: SVG QR code from our own route */}
          <img src={qrUrl} alt={t('scanAlt')} className="size-48 rounded-md bg-white p-1" />
          <p className="text-sm text-muted-foreground">{t('scanBody')}</p>
        </div>
      ) : null}
    </div>
  );
}
