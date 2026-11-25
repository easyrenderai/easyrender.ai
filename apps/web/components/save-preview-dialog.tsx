'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AuthFields } from '@/components/auth-fields';
import { SiteLink } from '@/components/site-link';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * The one sign-up panel for an anonymous visitor's preview: Google or email, nothing else.
 * Creating the account attaches the preview to it on the server (signupAttribution), so the page
 * only has to refresh to show the signed-in state.
 */
export function SavePreviewDialog({
  isOpen,
  onOpenChange,
  next,
  project,
  signInHref,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Where Google brings the visitor back to: the render page. */
  next: string;
  project: string;
  signInHref: string;
}) {
  const t = useTranslations('Render.gate');
  const router = useRouter();
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('save')}</DialogTitle>
          <DialogDescription className="sr-only">{t('panelDescription')}</DialogDescription>
        </DialogHeader>
        <AuthFields
          mode="sign-up"
          project={project}
          callbackURL={() => next}
          onDone={() => {
            onOpenChange(false);
            router.refresh();
          }}
        />
        <Button variant="ghost" className="w-full" asChild>
          <SiteLink href={signInHref}>{t('signIn')}</SiteLink>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
