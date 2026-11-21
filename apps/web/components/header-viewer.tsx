'use client';

import { AccountCreditsLink, AccountMenu } from '@/components/account-menu';
import { SiteLink as Link } from '@/components/site-link';
import { Button } from '@/components/ui/button';
import { useViewer } from '@/components/use-viewer';

// The parts of the marketing header that depend on who is looking. The header itself is built once
// and cached, so these start as the visitor's header and become the member's when /api/viewer
// answers (components/use-viewer). Labels are translated by the server component that renders them.

/** App for a member (the one primary button), Sign in for a visitor. Phones keep Sign in in the menu. */
export function HeaderSession({
  dashboardLabel,
  signInLabel,
  signInHref,
}: {
  dashboardLabel: string;
  signInLabel: string;
  signInHref: string;
}) {
  const { data } = useViewer();
  const isSignedIn = Boolean(data?.signedIn);
  if (isSignedIn) {
    return (
      <Button size="sm" asChild>
        <Link href="/dashboard">{dashboardLabel}</Link>
      </Button>
    );
  }
  return (
    <Button variant="ghost" size="sm" className="max-sm:hidden" asChild>
      <Link href={signInHref}>{signInLabel}</Link>
    </Button>
  );
}

/** The balance pill and account menu; nothing for a visitor. */
export function HeaderAccount() {
  const { data } = useViewer();
  return data?.account ? <AccountMenu placement="marketing" copy={data.account} /> : null;
}

/** The member's balance, first in the phone menu, where the account pill has no room. */
export function HeaderMenuCredits() {
  const { data } = useViewer();
  if (!data?.account) return null;
  return (
    <AccountCreditsLink
      label={data.account.balanceLabel ?? data.account.creditsLinkLabel}
      className="sm:hidden"
    />
  );
}

/** Sign in, last in the phone menu, for a visitor. A member already has App in the row. */
export function HeaderMenuSignIn({ label, href }: { label: string; href: string }) {
  const { data } = useViewer();
  if (data?.signedIn) return null;
  return (
    <Button variant="outline" className="mt-2 sm:hidden" asChild>
      <Link href={href}>{label}</Link>
    </Button>
  );
}
