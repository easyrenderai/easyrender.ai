'use client';
import { CONFIG_VERSION, isToolAllowed, type PrivacyRegion } from '@easyrender/core/attribution';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { attribution, gaPageview, initializeGa, setBrowserTools } from '@/lib/analytics/browser';
import { type ConsentChoice, readConsent } from '@/lib/analytics/consent';
import { isMailingTokenLocation } from '@/lib/mailing-privacy';

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
  const previous = readChoice();
  // Stop optional sends immediately, before React effects or pending gtag callbacks run.
  if (!accepted || (previous.advertising && !advertising))
    void setBrowserTools(hasPosthog, false, true, false);
  document.cookie = `er_consent=${encodeURIComponent(JSON.stringify({ version: CONFIG_VERSION, date: new Date().toISOString(), accepted, advertising: accepted && advertising }))}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  window.dispatchEvent(new Event('er-consent'));
}
export function ConsentControls() {
  const t = useTranslations('Analytics');
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => chooseConsent(true)}>
        {t('accept')}
      </Button>
      <Button variant="outline" onClick={() => chooseConsent(true, true)}>
        {t('acceptAdvertising')}
      </Button>
      <Button variant="outline" onClick={() => chooseConsent(false)}>
        {t('reject')}
      </Button>
    </div>
  );
}
export function Analytics() {
  const pathname = usePathname();
  if (isMailingTokenLocation(pathname)) return null;
  return <EnabledAnalytics />;
}
function EnabledAnalytics() {
  const t = useTranslations('Analytics');
  const locale = useLocale();
  const pathname = usePathname();
  const [region, setRegion] = useState<PrivacyRegion>(fallback);
  const [isResolved, setResolved] = useState(false);
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
    };
  }, []);
  // use-effect-audit: ignore loads or unloads the third-party analytics tools to match consent
  useEffect(() => {
    // Always after paint, outside the critical rendering path. Cancel pending imports on rejection.
    // PostHog starts on load: it does not wait for the privacy region or a consent choice.
    const ph =
      hasPosthog && isToolAllowed('posthog', region.consent_region, choice.accepted, region.gpc);
    const ga =
      isResolved &&
      Boolean(gaId) &&
      isToolAllowed('ga4', region.consent_region, choice.accepted, region.gpc);
    if (!ph && !ga) {
      void setBrowserTools(false, false, choice.accepted === false || region.gpc);
      return;
    }
    const timer = setTimeout(() => {
      void setBrowserTools(
        ph,
        ga,
        !ga && (choice.accepted === false || region.gpc),
        ga && choice.advertising && !region.gpc,
      );
    }, 100);
    return () => clearTimeout(timer);
  }, [region, choice, isResolved]);
  // use-effect-audit: ignore sends a GA pageview, an external system, when the route changes
  useEffect(() => {
    if (pathname) gaPageview();
  }, [pathname]);
  // Advertising always needs an explicit choice, including regions with opt-out GA policy.
  if (!isResolved || region.gpc || choice.accepted !== null || !gaId) return null;
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
