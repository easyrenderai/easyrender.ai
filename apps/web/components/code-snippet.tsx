'use client';

import { Check, Copy } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

export function CodeSnippet({
  code,
  label,
  copyLabel,
  copiedLabel,
  errorLabel,
}: {
  code: string;
  label: string;
  copyLabel: string;
  copiedLabel: string;
  errorLabel: string;
}) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
        <span className="min-w-0 text-xs text-muted-foreground">{label}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={async () => {
            clearTimeout(timer.current);
            try {
              await navigator.clipboard.writeText(code);
              setStatus('copied');
              timer.current = setTimeout(() => setStatus('idle'), 2000);
            } catch {
              setStatus('error');
            }
          }}
        >
          {status === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {status === 'copied' ? copiedLabel : copyLabel}
        </Button>
      </div>
      <section
        // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users must be able to scroll long code lines
        tabIndex={0}
        aria-label={label}
        className="overflow-x-auto p-5 text-xs leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <pre>
          <code>{code}</code>
        </pre>
      </section>
      <p
        role="status"
        className={status === 'error' ? 'px-5 pb-4 text-xs text-muted-foreground' : 'sr-only'}
      >
        {status === 'error' ? errorLabel : status === 'copied' ? copiedLabel : ''}
      </p>
    </div>
  );
}
