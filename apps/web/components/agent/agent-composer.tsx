'use client';

import { ArrowUp, ImagePlus, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const IMAGE_TYPES = 'image/jpeg,image/png,image/webp';

export type Attachment = { id: string; name: string };

// The message box: text, one photo, and Send. The photo goes up through the same upload route as
// everything else; the agent gets its id.
export function AgentComposer({
  isBusy,
  onSend,
  onUploadError,
}: {
  isBusy: boolean;
  onSend: (text: string, uploadId?: string) => void;
  onUploadError: () => void;
}) {
  const t = useTranslations('Agent');
  const file = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<Attachment | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function upload(picked: File | undefined) {
    if (!picked) return;
    setIsUploading(true);
    try {
      const body = new FormData();
      body.set('image', picked);
      const response = await fetch('/api/uploads', { method: 'POST', body });
      const data = response.ok ? ((await response.json()) as { id?: string }) : null;
      if (data?.id) setPhoto({ id: data.id, name: picked.name });
      else onUploadError();
    } catch {
      onUploadError();
    } finally {
      setIsUploading(false);
    }
  }

  const canSend = !isBusy && !isUploading && (text.trim() !== '' || photo !== null);
  function send() {
    if (!canSend) return;
    onSend(text.trim(), photo?.id);
    setText('');
    setPhoto(null);
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border bg-background p-2 shadow-xs">
      {photo && (
        <span className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border py-0.5 pr-1 pl-2.5 text-xs">
          <span className="truncate">{photo.name}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-5"
            aria-label={t('removePhoto')}
            onClick={() => setPhoto(null)}
          >
            <X />
          </Button>
        </span>
      )}
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            send();
          }
        }}
        placeholder={t('placeholder')}
        aria-label={t('placeholder')}
        maxLength={4000}
        rows={1}
        className="max-h-40 min-h-10 resize-none border-0 bg-transparent px-2 shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
      <div className="flex items-center justify-between">
        <Input
          ref={file}
          type="file"
          accept={IMAGE_TYPES}
          className="hidden"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            void upload(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('attach')}
          title={t('attach')}
          disabled={isBusy || isUploading}
          onClick={() => file.current?.click()}
        >
          {isUploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
        </Button>
        <Button
          size="icon"
          aria-label={t('send')}
          title={t('send')}
          disabled={!canSend}
          onClick={send}
        >
          {isBusy ? <Loader2 className="animate-spin" /> : <ArrowUp />}
        </Button>
      </div>
    </div>
  );
}
