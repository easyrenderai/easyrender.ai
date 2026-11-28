'use client';
import type { confirmedPurchase } from '@easyrender/core';
import {
  type Attribution,
  analyticsUrl,
  normalizeAttribution,
  normalizeCheckoutAttribution,
  sanitizeProperties,
  UTM_KEYS,
} from '@easyrender/core/attribution';
import { PRICING_FLAG, type PricingVariant } from '@easyrender/harness/pricing';
import type { PostHog } from 'posthog-js';
import { isBrowserBot } from '@/lib/bot';
import { GOOGLE_ADS_PURCHASE_SEND_TO, GOOGLE_ADS_SIGNUP_SEND_TO } from '@/lib/google-tag';
import { isMailingTokenLocation } from '@/lib/mailing-privacy';
import {
  AD_CLICK_KEYS,
  type AdvertisingTouch,
  advertisingUrl,
  readAdvertisingTouch,
} from './advertising';
import { readConsent } from './consent';
import { createEditorialMetrics } from './editorial';

declare global {
  interface Window {
    __erGoogleTagLoaded?: boolean;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}
let firstTouch: Attribution | null = null;
let landingUrl = '';
let testCountry: string | null = null;
let hasLanding = false;
let posthog: PostHog | null = null;
let cookielessPosthog: PostHog | null = null;
let consentedPosthog: PostHog | null = null;
let isPosthogAllowed = false;
let isSessionReplayEnabled = false;
let isGaAllowed = false;
let isAnalyticsIdentityAllowed = false;
let hasPosthogIdentity = false;
let isAdvertisingAllowed = false;
let advertisingTouch: AdvertisingTouch | null = null;
let advertisingExpiry: ReturnType<typeof setTimeout> | undefined;
let gaId = '';
let hasGaConfigured = false;
let lastGaPage = '';
const conversions = new Set<string>();
const observedRenders = new Map<string, { status: string; hasSheet: boolean }>();
export function attribution() {
  if (!firstTouch && typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    testCountry = url.searchParams.get('__geo');
    landingUrl = analyticsUrl(window.location.href);
    firstTouch = normalizeAttribution(
      {
        ...Object.fromEntries(UTM_KEYS.map((key) => [key, url.searchParams.get(key)])),
        referrer: document.referrer,
        landing_path: url.pathname,
      },
      url.origin,
    );
  }
  return firstTouch;
}
export function attributionHeaders(): Record<string, string> {
  attribution();
  return testCountry !== null ? { 'x-test-country': testCountry } : {};
}
export function beforeSend<T extends { event?: string; properties: Record<string, unknown> }>(
  event: T,
): T {
  const touch = attribution();
  const properties = sanitizeProperties({
    ui_locale: typeof document === 'undefined' ? undefined : document.documentElement?.lang,
    pricing_subject: browserPricingSubject(),
    pricing_variant: browserPricingVariant(),
    [`$feature/${PRICING_FLAG}`]: browserPricingVariant(),
    ...event.properties,
    // Runs even for a history pageview captured during init, before landing_view.
    ...Object.fromEntries(UTM_KEYS.flatMap((key) => (touch?.[key] ? [[key, touch[key]]] : []))),
  });
  // The SDK overwrites $session_id during capture. Use the verified checkout session on return.
  if (
    event.event === 'purchase_completed' &&
    allowsCheckoutIdentifiers() &&
    typeof properties.posthog_session_id === 'string'
  )
    properties.$session_id = properties.posthog_session_id;
  // PostHog requires its PUBLIC project write key in this SDK field. It is not a URL/auth token.
  if (event.properties.token === process.env.NEXT_PUBLIC_POSTHOG_KEY)
    properties.token = event.properties.token;
  return { ...event, properties };
}
export function initializeGa(id: string) {
  // The beforeInteractive bootstrap owns consent defaults, the queue and the only loader.
  // Keep its exact production hostname guard; previews and localhost never start Google tags.
  if (
    isBrowserBot() ||
    !id ||
    window.location.hostname !== 'easyrender.ai' ||
    !window.__erGoogleTagLoaded ||
    !window.gtag
  )
    return;
  gaId = id;
}
function googleUrl(value: string) {
  try {
    const url = new URL(value);
    return url.origin + url.pathname;
  } catch {
    return '';
  }
}
function googlePageLocation() {
  const url = new URL(
    advertisingUrl(window.location.href, isAdvertisingAllowed ? advertisingTouch : null),
  );
  const touch = attribution();
  for (const key of UTM_KEYS) if (touch?.[key]) url.searchParams.set(key, touch[key]);
  return url.toString();
}
export function gaPageview() {
  syncBrowserSessionReplay();
  if (!isGaAllowed || !gaId || !window.gtag || isMailingTokenLocation(window.location.href)) return;
  const page = googleUrl(window.location.href);
  if (lastGaPage === page) return;
  lastGaPage = page;
  const url = googlePageLocation();
  if (!hasGaConfigured) {
    hasGaConfigured = true;
    const touch = attribution();
    window.gtag('set', {
      campaign_source: touch?.utm_source ?? undefined,
      campaign_medium: touch?.utm_medium ?? undefined,
      campaign_name: touch?.utm_campaign ?? undefined,
      campaign_content: touch?.utm_content ?? undefined,
      campaign_term: touch?.utm_term ?? undefined,
    });
    window.gtag('config', gaId, {
      send_page_view: false,
      page_location: url,
      page_referrer: googleUrl(document.referrer),
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
  }
  window.gtag('event', 'page_view', {
    send_to: gaId,
    page_location: url,
    page_referrer: googleUrl(document.referrer),
  });
}
export function gaEvent(
  event: 'sign_up' | 'preview_ready' | 'render_ready' | 'purchase' | 'begin_checkout',
  properties: Record<string, unknown> = {},
  identity?: string,
) {
  if (!isGaAllowed || !gaId || !window.gtag || isMailingTokenLocation(window.location.href)) return;
  const key = identity ? `${event}:${identity}` : null;
  if (key && conversions.has(key)) return;
  if (key) conversions.add(key);
  window.gtag('event', event, {
    ui_locale: document.documentElement?.lang,
    pricing_variant: browserPricingVariant(),
    ...properties,
    send_to: gaId,
    page_location: googlePageLocation(),
    page_referrer: googleUrl(document.referrer),
  });
}
export function adsConversion(
  sendTo: string,
  identity: string,
  opts?: { value?: number; currency?: string; transactionId?: string },
) {
  if (
    !isAdvertisingAllowed ||
    window.location.hostname !== 'easyrender.ai' ||
    !window.gtag ||
    isMailingTokenLocation(window.location.href)
  )
    return;
  const key = `ads:${sendTo}:${opts?.transactionId ?? identity}`;
  if (opts?.transactionId ? hasPurchaseReceipt(key) : conversions.has(key)) return;
  window.gtag('event', 'conversion', {
    send_to: sendTo,
    ...(opts?.value !== undefined ? { value: opts.value } : {}),
    ...(opts?.currency !== undefined ? { currency: opts.currency } : {}),
    ...(opts?.transactionId !== undefined ? { transaction_id: opts.transactionId } : {}),
    page_location: googlePageLocation(),
    page_referrer: googleUrl(document.referrer),
  });
  if (opts?.transactionId) rememberPurchaseReceipt(key);
  else conversions.add(key);
}
export function observeRender(render: { id: string; status: string; hasSheet: boolean }) {
  const previous = observedRenders.get(render.id);
  observedRenders.set(render.id, { status: render.status, hasSheet: render.hasSheet });
  // A first snapshot establishes the baseline; opening a completed result is not a conversion.
  if (!previous) return;
  if (!previous.hasSheet && render.hasSheet) gaEvent('preview_ready', {}, render.id);
  if (previous.status !== 'ready' && render.status === 'ready')
    gaEvent('render_ready', {}, render.id);
}
export async function setBrowserTools(
  allowPosthog: boolean,
  allowGa: boolean,
  hasWithdrawal = false,
  allowAdvertising = false,
  hasAnalyticsPermission: boolean | null = allowGa,
) {
  if (isBrowserBot()) return;
  attribution();
  isAnalyticsIdentityAllowed = hasAnalyticsPermission === true && !hasWithdrawal;
  if (hasAnalyticsPermission === false || hasWithdrawal) {
    try {
      sessionStorage.removeItem('er_purchase_receipts');
      sessionStorage.removeItem('er_campaign');
      sessionStorage.removeItem('er_ad_touch');
    } catch {
      /* Storage unavailable. */
    }
  }
  isPosthogAllowed = allowPosthog;
  if (!allowsSessionReplay()) stopBrowserSessionReplay();
  syncPosthogIdentity();
  if (!allowPosthog) articleMetrics.clear();
  isGaAllowed = allowGa && Boolean(gaId);
  const wasAdvertisingAllowed = isAdvertisingAllowed;
  isAdvertisingAllowed = isGaAllowed && allowAdvertising && !hasWithdrawal;
  const hasAdvertisingWithdrawal =
    (wasAdvertisingAllowed && !isAdvertisingAllowed) || hasWithdrawal;
  clearTimeout(advertisingExpiry);
  try {
    const saved = JSON.parse(sessionStorage.getItem('er_ad_touch') ?? 'null');
    if (saved && !(typeof saved.expiresAt === 'number' && saved.expiresAt > Date.now()))
      sessionStorage.removeItem('er_ad_touch');
  } catch {
    /* Storage unavailable or invalid. */
  }
  if (isAdvertisingAllowed) {
    let saved: unknown = advertisingTouch;
    try {
      saved = JSON.parse(sessionStorage.getItem('er_ad_touch') ?? 'null');
    } catch {
      /* Memory only when storage is unavailable. */
    }
    advertisingTouch = readAdvertisingTouch(window.location.href, saved, true);
    try {
      if (advertisingTouch) sessionStorage.setItem('er_ad_touch', JSON.stringify(advertisingTouch));
      else sessionStorage.removeItem('er_ad_touch');
    } catch {
      /* Keep only in-memory attribution. */
    }
    if (advertisingTouch) {
      advertisingExpiry = setTimeout(
        () => {
          advertisingTouch = null;
          try {
            sessionStorage.removeItem('er_ad_touch');
          } catch {
            /* Storage unavailable. */
          }
          window.gtag?.('set', { page_location: googlePageLocation() });
        },
        Math.max(0, advertisingTouch.expiresAt - Date.now()),
      );
      advertisingExpiry.unref?.();
    }
  } else {
    advertisingTouch = null;
    if (hasAdvertisingWithdrawal) {
      try {
        sessionStorage.removeItem('er_ad_touch');
      } catch {
        /* Storage unavailable. */
      }
      try {
        localStorage.removeItem('_gcl_ls');
      } catch {
        /* Google's conversion-linker storage may be unavailable. */
      }
    }
  }
  // Remove consumed/rejected click IDs from the address so a reload cannot renew their TTL.
  if (advertisingTouch || hasAdvertisingWithdrawal) {
    try {
      const url = new URL(window.location.href);
      for (const key of AD_CLICK_KEYS) url.searchParams.delete(key);
      window.history.replaceState(window.history.state, '', url);
    } catch {
      /* Sandboxed clients may not expose History. */
    }
  }
  if (window.__erGoogleTagLoaded && window.location.hostname === 'easyrender.ai') {
    // Clear redaction/URL state before consent updates; personalization is never granted.
    window.gtag?.('set', 'ads_data_redaction', !isAdvertisingAllowed);
    window.gtag?.('set', {
      page_location: googlePageLocation(),
    });
    if (gaId) Object.assign(window, { [`ga-disable-${gaId}`]: !isGaAllowed });
    window.gtag?.('consent', 'update', {
      analytics_storage: isGaAllowed ? 'granted' : 'denied',
      ad_storage: isAdvertisingAllowed ? 'granted' : 'denied',
      ad_user_data: isAdvertisingAllowed ? 'granted' : 'denied',
      ad_personalization: 'denied',
    });
  }
  if ((!allowGa && hasWithdrawal) || hasAdvertisingWithdrawal) {
    void fetch('/api/analytics/revoke', { method: 'POST', keepalive: true }).catch(() => undefined);
    try {
      if (!allowGa) sessionStorage.removeItem('er_campaign');
    } catch {
      /* Storage unavailable. */
    }
  }
  if (!allowGa) lastGaPage = '';
  for (const cookie of hasWithdrawal || hasAdvertisingWithdrawal
    ? document.cookie.split(';')
    : []) {
    const name = cookie.trim().split('=')[0];
    if (!((!allowGa && /^_ga(?:_|$)/.test(name)) || (!isAdvertisingAllowed && /^_gcl_/.test(name))))
      continue;
    const domains = ['', window.location.hostname, `.${window.location.hostname}`];
    const labels = window.location.hostname.split('.');
    for (let i = 1; i < labels.length - 1; i++) domains.push(`.${labels.slice(i).join('.')}`);
    for (const domain of domains) {
      // biome-ignore lint/suspicious/noDocumentCookie: expires Google cookies after consent is withdrawn; the Cookie Store API is missing in Safari and Firefox.
      document.cookie = `${name}=; Max-Age=0; Path=/${domain ? `; Domain=${domain}` : ''}`;
    }
  }
  if (allowsCheckoutIdentifiers()) restoreCampaign();
  if (allowGa && gaId) {
    gaPageview();
    void captureSignup();
  }
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!allowPosthog || !key) return;
  if (!posthog) {
    const { default: sdk } = await import('posthog-js');
    // Concurrent consent effects can await the same module import. Initialize only once.
    if (!isPosthogAllowed || posthog) return;
    const hasIdentityPermission = allowsCheckoutIdentifiers();
    // The SDK creates its session manager only at initialization (or its persistent opt-in API).
    // Separate memory-only instances avoid inventing a shared cookieless ID or a consent cookie.
    const instance = sdk.init(
      key,
      {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
        cookieless_mode: hasIdentityPermission ? undefined : 'always',
        persistence: 'memory',
        disable_persistence: true,
        save_campaign_params: false,
        autocapture: false,
        disable_session_recording: !allowsSessionReplay(),
        enable_recording_console_log: false,
        session_recording: {
          maskAllInputs: true,
          // Text and attributes can expose names/emails outside form controls too.
          maskTextSelector: '*',
          maskAllElementAttributes: true,
          blockSelector:
            'form, input[type="file"], [contenteditable], a[href^="mailto:"], [data-sensitive], [data-private], .ph-no-capture, iframe, img, video, canvas',
          recordBody: false,
          recordHeaders: false,
          captureCanvas: { recordCanvas: false },
          captureJsonLd: false,
          inlineStylesheet: false,
          // This hook also masks rrweb's page metadata, which bypasses analyticsUrl.
          maskCapturedNetworkRequestFn: (request) =>
            allowsSessionReplay() && !request.method && isReplayLocationAllowed(request.name)
              ? {
                  name: googleUrl(request.name),
                  duration: request.duration,
                  entryType: request.entryType,
                  startTime: request.startTime,
                }
              : null,
        },
        capture_pageview: 'history_change',
        capture_pageleave: false,
        // Only explicit page/landing events: avoid retaining a batch after consent is withdrawn.
        request_batching: false,
        person_profiles: 'never',
        advanced_disable_feature_flags: true,
        disable_surveys: true,
        enable_heatmaps: false,
        capture_exceptions: false,
        before_send: (event) => {
          // Recheck on SDK history pageviews as well as React route changes.
          if (!allowsSessionReplay()) stopBrowserSessionReplay();
          return event &&
            isPosthogAllowed &&
            hasIdentityPermission === allowsCheckoutIdentifiers() &&
            !isMailingTokenLocation(window.location.href) &&
            (event.event !== '$snapshot' ||
              (hasIdentityPermission && isSessionReplayEnabled && allowsSessionReplay()))
            ? beforeSend(event)
            : null;
        },
      },
      hasIdentityPermission ? 'er_consented' : 'er_cookieless',
    );
    if (!instance) return;
    if (hasIdentityPermission) consentedPosthog = instance;
    else cookielessPosthog = instance;
    posthog = instance;
  }
  syncBrowserSessionReplay();
  capturePricingView();
  articleMetrics.flush();
  if (!hasLanding) {
    hasLanding = true;
    const a = attribution();
    const url = new URL(landingUrl);
    let referrerHost = '';
    try {
      referrerHost = new URL(document.referrer).hostname;
    } catch {
      /* direct visit */
    }
    if (referrerHost !== url.hostname || UTM_KEYS.some((key) => url.searchParams.has(key))) {
      const path = url.pathname.replace(/^\/(es|de|fr|it|pt)(?=\/|$)/, '') || '/';
      const landingType =
        path === '/mcp'
          ? 'mcp'
          : path === '/image-to-3d-api' || path === '/api-imagen-a-3d'
            ? 'api'
            : path === '/'
              ? 'home'
              : path.startsWith('/r/')
                ? 'model_page'
                : path === '/explore'
                  ? 'explore'
                  : path === '/credits'
                    ? 'credits'
                    : path.includes('services')
                      ? 'services'
                      : 'other';
      posthog.capture('landing_view', {
        landing_type: landingType,
        ...Object.fromEntries(UTM_KEYS.map((key) => [key, a?.[key] ?? null])),
        referrer_host: referrerHost,
      });
    }
  }
}

export function browserPricingVariant(): PricingVariant {
  if (typeof document === 'undefined') return 'control';
  const value =
    document
      .querySelector?.('[data-pricing-variant]:not(html)')
      ?.getAttribute('data-pricing-variant') ?? document.documentElement?.dataset.pricingVariant;
  return value === 'test' ? 'test' : 'control';
}
export function captureBrowser(event: string, properties: Record<string, unknown> = {}) {
  if (!isPosthogAllowed || !posthog || isMailingTokenLocation(window.location.href)) return false;
  posthog.capture(event, {
    ...([
      'photo_selected',
      'render_preview_created',
      'render_sheet_generation_started',
      'render_generation_started',
    ].includes(event)
      ? articleMetrics.context()
      : {}),
    pricing_subject: browserPricingSubject(),
    pricing_variant: browserPricingVariant(),
    [`$feature/${PRICING_FLAG}`]: browserPricingVariant(),
    ...properties,
  });
  return true;
}
export const articleMetrics = createEditorialMetrics(captureBrowser);
let visiblePricing: PricingVariant | null = null;
const pricingViews = new Set<string>();
export function observePricing(variant: PricingVariant) {
  visiblePricing = variant;
  capturePricingView();
}
export function stopObservingPricing() {
  visiblePricing = null;
}
function capturePricingView() {
  if (!isPosthogAllowed || !posthog || !visiblePricing) return;
  const key = `${location.pathname}:${visiblePricing}`;
  if (pricingViews.has(key)) return;
  pricingViews.add(key);
  captureBrowser('pricing_viewed', {
    pricing_variant: visiblePricing,
    [`$feature/${PRICING_FLAG}`]: visiblePricing,
  });
}

function browserPricingSubject(): string | null {
  if (typeof document === 'undefined') return null;
  return (
    document
      .querySelector?.('[data-pricing-subject]:not(html)')
      ?.getAttribute('data-pricing-subject') ??
    document.documentElement?.dataset.pricingSubject ??
    null
  );
}

/** The backend claims a real account-creation receipt once, regardless of OAuth URL parameters. */
export async function captureSignup() {
  if (!isGaAllowed || !gaId) return;
  try {
    const response = await fetch('/api/analytics/signup', { method: 'POST' });
    if (!response.ok || response.status === 204) return;
    const result: unknown = await response.json();
    if (
      result &&
      typeof result === 'object' &&
      'method' in result &&
      (result.method === 'email' || result.method === 'google')
    ) {
      gaEvent('sign_up', { method: result.method });
      adsConversion(GOOGLE_ADS_SIGNUP_SEND_TO, 'signup');
    }
  } catch {
    /* Missing delivery is preferable to inventing a signup. */
  }
}

/** Consent-gated session context; never persists click IDs or arbitrary URL parameters. */
function restoreCampaign() {
  attribution();
  try {
    const saved = JSON.parse(sessionStorage.getItem('er_campaign') ?? 'null');
    if (saved?.expiresAt > Date.now() && saved.expiresAt <= Date.now() + 30 * 60 * 1000) {
      firstTouch = normalizeAttribution(saved.touch, window.location.origin);
    }
    sessionStorage.setItem(
      'er_campaign',
      JSON.stringify({
        touch: firstTouch,
        expiresAt:
          saved?.expiresAt > Date.now() && saved.expiresAt <= Date.now() + 30 * 60 * 1000
            ? saved.expiresAt
            : Date.now() + 30 * 60 * 1000,
      }),
    );
  } catch {
    /* Browser storage may be unavailable; keep in-memory attribution. */
  }
}

/** Ask the configured Google tag, never parse its evolving cookie format. Timeout cannot block checkout. */
export async function googleCheckoutContext() {
  if (!isGaAllowed || !gaId || !window.gtag || !allowsCheckoutIdentifiers()) return null;
  const read = (field: string) =>
    new Promise<unknown>((resolve) => {
      const timer = setTimeout(() => resolve(null), 1000);
      window.gtag?.('get', gaId, field, (value: unknown) => {
        clearTimeout(timer);
        resolve(value);
      });
    });
  const [clientId, sessionId] = await Promise.all([read('client_id'), read('session_id')]);
  if (!isGaAllowed || !allowsCheckoutIdentifiers() || typeof clientId !== 'string' || !sessionId)
    return null;
  return {
    measurementId: gaId,
    clientId,
    sessionId: String(sessionId),
    adMeasurementAllowed: allowsCheckoutAdvertising(),
  };
}

function allowsCheckoutIdentifiers() {
  if (!isAnalyticsIdentityAllowed || typeof window === 'undefined') return false;
  const hasGpc =
    typeof navigator !== 'undefined' &&
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
  return (
    !hasGpc &&
    readConsent(document.cookie.match(/(?:^|;\s*)er_consent=([^;]+)/)?.[1]).accepted !== false
  );
}

function allowsCheckoutAdvertising() {
  const choice = readConsent(document.cookie.match(/(?:^|;\s*)er_consent=([^;]+)/)?.[1]);
  return (
    allowsCheckoutIdentifiers() &&
    isAdvertisingAllowed &&
    (choice.accepted === null || choice.advertising)
  );
}

function isReplayLocationAllowed(value: string) {
  if (isMailingTokenLocation(value)) return false;
  try {
    const path = new URL(value).pathname.replace(/^\/(en|es|de|fr|it|pt)(?=\/|$)/, '');
    return !/^\/(admin|account|checkout|billing|email|sign-in|sign-up|oauth)(?:\/|$)/.test(path);
  } catch {
    return false;
  }
}
function allowsSessionReplay() {
  return (
    isPosthogAllowed &&
    allowsCheckoutIdentifiers() &&
    // Regional defaults may allow analytics IDs, but replay always needs an explicit grant.
    readConsent(document.cookie.match(/(?:^|;\s*)er_consent=([^;]+)/)?.[1]).accepted === true &&
    isReplayLocationAllowed(window.location.href)
  );
}
export function stopBrowserSessionReplay() {
  if (!isSessionReplayEnabled) return;
  // Flip the send guard before stop: the SDK may flush buffered snapshots during teardown.
  isSessionReplayEnabled = false;
  consentedPosthog?.stopSessionRecording();
}
function syncBrowserSessionReplay() {
  if (!allowsSessionReplay()) {
    stopBrowserSessionReplay();
  } else if (consentedPosthog && !isSessionReplayEnabled) {
    isSessionReplayEnabled = true;
    // Memory persistence still has a session manager. Respect remote enablement/sampling.
    consentedPosthog.startSessionRecording();
  }
}

function syncPosthogIdentity() {
  const isAllowed = allowsCheckoutIdentifiers();
  if (hasPosthogIdentity !== isAllowed) {
    hasLanding = false;
    if (!isAllowed) {
      stopBrowserSessionReplay();
      consentedPosthog?.reset(true);
    }
    hasPosthogIdentity = isAllowed;
  }
  posthog = isAllowed ? consentedPosthog : cookielessPosthog;
}

/** Only optional, consented identities cross the checkout boundary; prices and locale are server-owned. */
export function checkoutAttribution() {
  syncPosthogIdentity();
  const isAllowed = allowsCheckoutIdentifiers();
  const touch = attribution();
  let referrerHost = '';
  try {
    referrerHost = new URL(touch?.referrer ?? '').hostname;
  } catch {
    /* Direct visit. */
  }
  const adTouch =
    isAllowed && allowsCheckoutAdvertising()
      ? readAdvertisingTouch(window.location.href, advertisingTouch, true)
      : null;
  return normalizeCheckoutAttribution(
    {
      ...touch,
      referrer_host: referrerHost,
      ...(isAllowed && posthog
        ? {
            posthog_distinct_id: posthog.get_distinct_id(),
            posthog_session_id: posthog.get_session_id(),
          }
        : {}),
      ...adTouch?.ids,
    },
    isAllowed,
    isAllowed && allowsCheckoutAdvertising(),
  );
}

type Confirmation = NonNullable<Awaited<ReturnType<typeof confirmedPurchase>>>;
function hasPurchaseReceipt(key: string) {
  if (conversions.has(key)) return true;
  try {
    return JSON.parse(sessionStorage.getItem('er_purchase_receipts') ?? '[]').includes(key);
  } catch {
    return false;
  }
}
function rememberPurchaseReceipt(key: string) {
  conversions.add(key);
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem('er_purchase_receipts') ?? '[]');
    const receipts = Array.isArray(saved) ? saved.filter((value) => typeof value === 'string') : [];
    sessionStorage.setItem('er_purchase_receipts', JSON.stringify([...receipts.slice(-99), key]));
  } catch {
    /* Memory-only dedup when storage is blocked. */
  }
}

/** Called only with an owner-scoped, paid confirmation, never success-page URL values. */
export function reportPurchaseConversion(result: Confirmation) {
  if (!allowsCheckoutIdentifiers() || isMailingTokenLocation(window.location.href)) return;
  const key = `posthog:purchase:${result.transaction_id}`;
  const entry = result.posthog;
  if (isPosthogAllowed && posthog && entry && !hasPurchaseReceipt(key)) {
    const properties = entry.properties as Record<string, unknown>;
    const captured = posthog.capture(
      'purchase_completed',
      {
        ...properties,
        distinct_id: entry.distinctId,
      },
      { uuid: entry.id, timestamp: new Date(entry.occurredAt) },
    );
    if (captured) rememberPurchaseReceipt(key);
  }
  // This website Ads action is independent of the server-managed GA4 purchase/import.
  if (allowsCheckoutAdvertising()) {
    adsConversion(GOOGLE_ADS_PURCHASE_SEND_TO, result.transaction_id, {
      value: result.value,
      currency: result.currency,
      transactionId: result.transaction_id,
    });
  }
  const gaKey = `ga:purchase:${result.transaction_id}`;
  if (
    result.server_managed ||
    !allowsCheckoutAdvertising() ||
    !isGaAllowed ||
    !gaId ||
    !window.gtag ||
    hasPurchaseReceipt(gaKey)
  )
    return;
  const {
    posthog: _posthog,
    server_managed: _managed,
    issued_credits: _credits,
    ...purchase
  } = result;
  gaEvent('purchase', purchase, purchase.transaction_id);
  rememberPurchaseReceipt(gaKey);
}
