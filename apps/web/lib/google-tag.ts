import { MAILING_TOKEN_CHECK_SCRIPT } from '@/lib/mailing-privacy';

// Public Google Ads destination selected in this account's installation screen. The AW
// prefix limits this container to Google tags. Never add a second GTM/GA loader alongside it.
export const GOOGLE_ADS_TAG_ID = 'AW-18570382360';

// The current Google snippet uses gtm.js and gtag('js'); no legacy config call is needed.
// Denied consent is the bootstrap state, not a substitute for the separate consent/analytics
// work. This installs the base tag only: no purchase or other conversion is fabricated.
export const GOOGLE_TAG_BOOTSTRAP = `${MAILING_TOKEN_CHECK_SCRIPT}
(function () {
  if (window.location.hostname !== 'easyrender.ai' || window.__erGoogleTagLoaded) return;
  // Token pages (invite, verify, reset, unsubscribe) never load a Google tag.
  if (erIsMailingTokenLocation(window.location.href)) return;
  window.__erGoogleTagLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    ad_storage: 'denied', analytics_storage: 'denied',
    ad_user_data: 'denied', ad_personalization: 'denied'
  });
  window.gtag('set', 'ads_data_redaction', true);
  window.gtag('set', 'url_passthrough', false);
  var referrer = '';
  try {
    var from = new URL(document.referrer);
    referrer = from.origin + from.pathname;
  } catch (_) {}
  window.gtag('set', {
    page_location: window.location.origin + window.location.pathname,
    page_referrer: referrer,
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });
  window.gtag('js', new Date());
  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtm.js?id=${GOOGLE_ADS_TAG_ID}';
  document.head.appendChild(script);
})();`;
