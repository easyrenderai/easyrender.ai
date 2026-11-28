'use client';
import { CONFIG_VERSION, isToolAllowed, type PrivacyRegion } from '@easyrender/core/attribution';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useViewer } from '@/components/use-viewer';
import {
  attribution,
  gaPageview,
  initializeGa,
  setBrowserTools,
  stopBrowserSessionReplay,
} from '@/lib/analytics/browser';
import {
  allowsAdvertisingMeasurement,
  type ConsentChoice,
  readConsent,
} from '@/lib/analytics/consent';
import { isMailingTokenLocation } from '@/lib/mailing-privacy';
import { useSitePathname } from '@/lib/use-site-pathname';

const hasPosthog = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';
const fallback: PrivacyRegion = {
  country: null,
  consent_region: 'strict',
  gpc: false,
  config_version: CONFIG_VERSION,
};
export function cookiesPath(locale: string) {
  return locale === 'en' ? '/cookies' : `/${locale}/${locale === 'it' ? 'cookie' : 'cookies'}`;
}
function readChoice(): ConsentChoice {
  return readConsent(document.cookie.match(/(?:^|;\s*)er_consent=([^;]+)/)?.[1]);
}
export function chooseConsent(accepted: boolean, advertising = false) {
  // Stop optional sends immediately, before React effects or pending gtag callbacks run.
  // This also withdraws an implicit standard-region grant with no saved cookie yet.
  if (!accepted || !advertising) void setBrowserTools(hasPosthog, false, true, false);
  // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is missing in Safari and Firefox, and the consent cookie is written synchronously before the event below.
  document.cookie = `er_consent=${encodeURIComponent(JSON.stringify({ version: CONFIG_VERSION, date: new Date().toISOString(), accepted, advertising: accepted && advertising }))}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  window.dispatchEvent(new Event('er-consent'));
}
export function ConsentControls({ isGranular = false }: { isGranular?: boolean } = {}) {
  const t = useTranslations('Analytics');
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => chooseConsent(true, true)}>
        {t('accept')}
      </Button>
      <Button variant="outline" onClick={() => chooseConsent(false)}>
        {t('reject')}
      </Button>
      {isGranular && (
        <Button variant="outline" onClick={() => chooseConsent(true)}>
          {t('analyticsOnly')}
        </Button>
      )}
    </div>
  );
}
export function Analytics() {
  const pathname = useSitePathname();
  // The full address, query included: a sign-in page can carry an invite in `next`. Only the
  // browser has it, and the first render of a hydrating page may not know it yet, which is
  // harmless: this component renders nothing on the server either way.
  const isPrivate =
    isMailingTokenLocation(pathname) ||
    (typeof window !== 'undefined' && isMailingTokenLocation(window.location.href));
  // The pricing arm and experiment subject the browser analytics attach to every event.
  useViewer({ isEnabled: !isPrivate });
  if (isPrivate) return null;
  return <EnabledAnalytics />;
}
function EnabledAnalytics() {
  const t = useTranslations('Analytics');
  const locale = useLocale();
  const pathname = useSitePathname();
  const [region, setRegion] = useState<PrivacyRegion>(fallback);
  const [isResolved, setResolved] = useState(false);
  const [hasRegionFailed, setRegionFailed] = useState(false);
  const [choice, setChoice] = useState<ConsentChoice>({ accepted: null, advertising: false });
  // use-effect-audit: ignore initialises GA, subscribes to the consent event and fetches the privacy region on mount
  useEffect(() => {
    attribution();
    initializeGa(gaId);
    setChoice(readChoice());
    const changed = () => setChoice(readChoice());
    window.addEventListener('er-consent', changed);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const query = new URLSearchParams(location.search);
    const params = new URLSearchParams();
    for (const key of ['__geo', '__privacy_fail'])
      if (query.has(key)) params.set(key, query.get(key) ?? '');
    const hasGpc =
      (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
    void fetch(`/api/privacy-region?${params}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('region unavailable');
        const result = (await response.json()) as PrivacyRegion;
        if (!['strict', 'standard'].includes(result.consent_region))
          throw new Error('invalid region');
        setRegion({ ...result, gpc: hasGpc || result.gpc });
        setResolved(true);
      })
      .catch(() => {
        setRegionFailed(true);
        setRegion({
          ...fallback,
          gpc: hasGpc,
        }); /* No optional load on failure, even with a previous choice. */
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      controller.abort();
      clearTimeout(timeout);
      window.removeEventListener('er-consent', changed);
      stopBrowserSessionReplay();
    };
  }, []);
  // use-effect-audit: ignore loads or unloads the third-party analytics tools to match consent
  useEffect(() => {
    // Always after paint, outside the critical rendering path. Cancel pending imports on rejection.
    // PostHog starts on load: it does not wait for the privacy region or a consent choice.
    const ph =
      hasPosthog && isToolAllowed('posthog', region.consent_region, choice.accepted, region.gpc);
    const hasIdentityPermission =
      isResolved && isToolAllowed('ga4', region.consent_region, choice.accepted, region.gpc);
    const ga = Boolean(gaId) && hasIdentityPermission;
    if (!ph && !ga) {
      void setBrowserTools(false, false, choice.accepted === false || region.gpc);
      return;
    }
    const timer = setTimeout(() => {
      void setBrowserTools(
        ph,
        ga,
        !ga && (choice.accepted === false || region.gpc),
        ga && allowsAdvertisingMeasurement(region, choice),
        isResolved || hasRegionFailed ? hasIdentityPermission : null,
      );
    }, 100);
    return () => clearTimeout(timer);
  }, [region, choice, isResolved, hasRegionFailed]);
  // use-effect-audit: ignore sends a GA pageview, an external system, when the route changes
  useEffect(() => {
    if (pathname) gaPageview();
  }, [pathname]);
  // Standard regions use opt-out Google measurement and cookie-page controls without a prompt.
  if (
    !isResolved ||
    region.consent_region !== 'strict' ||
    region.gpc ||
    choice.accepted !== null ||
    !gaId
  )
    return null;
  return (
    <aside
      aria-label={t('title')}
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-lg border bg-background p-4 text-sm shadow-lg"
      data-testid="consent-banner"
    >
      <p className="mb-3 text-muted-foreground">{t('banner')}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ConsentControls />
        <Link href={cookiesPath(locale)} className="underline underline-offset-4">
          {t('details')}
        </Link>
      </div>
    </aside>
  );
}
