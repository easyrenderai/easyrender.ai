'use client';
import {
  type Attribution,
  analyticsUrl,
  normalizeAttribution,
  sanitizeProperties,
  UTM_KEYS,
} from '@easyrender/core/attribution';
import { PRICING_FLAG, type PricingVariant } from '@easyrender/harness/pricing';
import type { PostHog } from 'posthog-js';
import { isMailingTokenLocation } from '@/lib/mailing-privacy';
import {
  AD_CLICK_KEYS,
  type AdvertisingTouch,
  advertisingUrl,
  readAdvertisingTouch,
} from './advertising';
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
let isPosthogAllowed = false;
let isGaAllowed = false;
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
export function beforeSend<T extends { properties: Record<string, unknown> }>(event: T): T {
  const properties = sanitizeProperties({
    pricing_subject: browserPricingSubject(),
    pricing_variant: browserPricingVariant(),
    [`$feature/${PRICING_FLAG}`]: browserPricingVariant(),
    ...event.properties,
  });
  // PostHog requires its PUBLIC project write key in this SDK field. It is not a URL/auth token.
  if (event.properties.token === process.env.NEXT_PUBLIC_POSTHOG_KEY)
    properties.token = event.properties.token;
  return { ...event, properties };
}
export function initializeGa(id: string) {
  // The beforeInteractive bootstrap owns consent defaults, the queue and the only loader.
  // Keep its exact production hostname guard; previews and localhost never start Google tags.
  if (
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
export function gaPageview() {
  if (!isGaAllowed || !gaId || !window.gtag || isMailingTokenLocation(window.location.href)) return;
  const page = googleUrl(window.location.href);
  if (lastGaPage === page) return;
  lastGaPage = page;
  const url = advertisingUrl(window.location.href, isAdvertisingAllowed ? advertisingTouch : null);
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
    pricing_variant: browserPricingVariant(),
    ...properties,
    send_to: gaId,
    page_location: advertisingUrl(
      window.location.href,
      isAdvertisingAllowed ? advertisingTouch : null,
    ),
    page_referrer: googleUrl(document.referrer),
  });
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
) {
  isPosthogAllowed = allowPosthog;
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
          window.gtag?.('set', { page_location: googleUrl(window.location.href) });
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
      page_location: advertisingUrl(
        window.location.href,
        isAdvertisingAllowed ? advertisingTouch : null,
      ),
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
    for (const domain of domains)
      document.cookie = `${name}=; Max-Age=0; Path=/${domain ? `; Domain=${domain}` : ''}`;
  }
  if (allowGa && gaId) {
    restoreCampaign();
    gaPageview();
    void captureSignup();
  }
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!allowPosthog || !key) return;
  if (!posthog) {
    const { default: sdk } = await import('posthog-js');
    // Concurrent consent effects can await the same module import. Initialize only once.
    if (!isPosthogAllowed || posthog) return;
    posthog = sdk;
    sdk.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
      cookieless_mode: 'always',
      persistence: 'memory',
      autocapture: false,
      disable_session_recording: true,
      capture_pageview: 'history_change',
      capture_pageleave: false,
      // Only explicit page/landing events: avoid retaining a batch after consent is withdrawn.
      request_batching: false,
      person_profiles: 'never',
      advanced_disable_feature_flags: true,
      disable_surveys: true,
      enable_heatmaps: false,
      capture_exceptions: false,
      before_send: (event) =>
        event && isPosthogAllowed && !isMailingTokenLocation(window.location.href)
          ? beforeSend(event)
          : null,
    });
  }
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
    )
      gaEvent('sign_up', { method: result.method });
  } catch {
    /* Missing delivery is preferable to inventing a signup. */
  }
}

/** Consent-gated session context; never persists click IDs or arbitrary URL parameters. */
function restoreCampaign() {
  const current = attribution();
  try {
    const saved = JSON.parse(sessionStorage.getItem('er_campaign') ?? 'null');
    if (
      saved?.expiresAt > Date.now() &&
      saved.expiresAt <= Date.now() + 30 * 60 * 1000 &&
      !UTM_KEYS.some((key) => current?.[key])
    ) {
      firstTouch = normalizeAttribution(saved.touch, window.location.origin);
    }
    sessionStorage.setItem(
      'er_campaign',
      JSON.stringify({
        touch: firstTouch,
        expiresAt: Date.now() + 30 * 60 * 1000,
      }),
    );
  } catch {
    /* Browser storage may be unavailable; keep in-memory attribution. */
  }
}

/** Ask the configured Google tag, never parse its evolving cookie format. Timeout cannot block checkout. */
export async function googleCheckoutContext() {
  if (!isGaAllowed || !gaId || !window.gtag) return null;
  const read = (field: string) =>
    new Promise<unknown>((resolve) => {
      const timer = setTimeout(() => resolve(null), 1000);
      window.gtag?.('get', gaId, field, (value: unknown) => {
        clearTimeout(timer);
        resolve(value);
      });
    });
  const [clientId, sessionId] = await Promise.all([read('client_id'), read('session_id')]);
  if (!isGaAllowed || typeof clientId !== 'string' || !sessionId) return null;
  return {
    measurementId: gaId,
    clientId,
    sessionId: String(sessionId),
    adMeasurementAllowed: isAdvertisingAllowed,
  };
}
