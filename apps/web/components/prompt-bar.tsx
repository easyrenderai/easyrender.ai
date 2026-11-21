'use client';

import { ImagePlus, Loader2, TriangleAlert } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { SiteLink as Link } from '@/components/site-link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useActivationError } from '@/lib/activation-errors';
import {
  attribution,
  attributionHeaders,
  captureBrowser,
  observeRender,
} from '@/lib/analytics/browser';
import { TRY_ONE_EXAMPLES } from '@/lib/marketing-examples';
import { prepare } from '@/lib/prepare-image';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export { prepare };

/**
 * The try page's upload: one button. Choosing, dropping or pasting a photo starts the free
 * preview at once, and the result page asks for an account before it shows the sheet.
 */
export function PromptBar() {
  const t = useTranslations('PromptBar');
  const localizedError = useActivationError();
  const showcase = useTranslations('Showcase');
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const isSubmitting = useRef(false);
  const [isBusy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(file: File | null | undefined) {
    if (!file || isSubmitting.current) return;
    if (!TYPES.includes(file.type)) {
      setError(t('errors.type'));
      return;
    }
    isSubmitting.current = true;
    setBusy(true);
    setError(null);
    captureBrowser('photo_selected', { source: 'try' });
    let isLeaving = false;
    try {
      const body = new FormData();
      body.append('attribution', JSON.stringify(attribution()));
      const photo = await prepare(file).catch(() => null);
      if (!photo) {
        setError(t('errors.unreadable'));
      } else {
        body.append('image', photo, 'source.jpg');
        body.append('prompt', '');
        body.append('isPublic', 'false');
        const response = await fetch('/api/renders', {
          method: 'POST',
          body,
          headers: { ...attributionHeaders(), 'idempotency-key': crypto.randomUUID() },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || typeof data.id !== 'string') {
          setError(localizedError(data, t('errors.upload')));
        } else {
          observeRender(data);
          captureBrowser('render_preview_created', { source: 'try', has_prompt: false });
          // The status and the sheet are on the render's page. A visitor without an account sees
          // the sheet blurred there, with the sign-up that unlocks it.
          isLeaving = true;
          router.push(`/r/${data.id}`);
        }
      }
    } catch {
      setError(t('errors.upload'));
    }
    if (input.current) input.current.value = '';
    if (isLeaving) return;
    isSubmitting.current = false;
    setBusy(false);
  }

  return (
    <fieldset
      aria-label={t('startPreview')}
      className="m-0 w-full min-w-0 space-y-4 border-0 p-0"
      aria-busy={isBusy}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        void start(event.dataTransfer.files[0]);
      }}
      onPaste={(event) => {
        const pasted = Array.from(event.clipboardData.files).find((item) =>
          item.type.startsWith('image/'),
        );
        if (pasted) {
          event.preventDefault();
          void start(pasted);
        }
      }}
    >
      <Input
        ref={input}
        type="file"
        accept={TYPES.join(',')}
        className="hidden"
        tabIndex={-1}
        aria-hidden
        disabled={isBusy}
        onChange={(event) => void start(event.target.files?.[0])}
      />
      <Button
        type="button"
        size="lg"
        className="h-12 w-full text-base"
        disabled={isBusy}
        onClick={() => input.current?.click()}
      >
        {isBusy ? <Loader2 className="animate-spin" /> : <ImagePlus />}
        {isBusy ? t('uploadingReal') : t('startPreview')}
      </Button>
      <p className="text-center text-xs leading-relaxed text-muted-foreground">{t('tryNote')}</p>
      {isBusy && (
        <p role="status" className="text-center text-sm text-muted-foreground">
          {t('uploadingHint')}
        </p>
      )}
      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>{t('errors.title')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        <span className="text-muted-foreground">{t('seeExample')}</span>
        {TRY_ONE_EXAMPLES.map((example) => (
          <Button key={example.id} variant="outline" size="sm" asChild>
            <Link href={`/r/${example.id}`}>
              <Image
                src={example.photo}
                alt=""
                width={20}
                height={20}
                sizes="20px"
                className="size-5 rounded-full object-cover"
              />
              {showcase(`items.${example.slug}.title`)}
            </Link>
          </Button>
        ))}
      </div>
    </fieldset>
  );
}
