import { isToolAllowed } from '@easyrender/core/attribution';
import { allowsAdvertisingMeasurement, readConsent } from './consent';
import { privacyRegion } from './privacy-region';

function choice(headers: Headers) {
  return readConsent(headers.get('cookie')?.match(/(?:^|;\s*)er_consent=([^;]+)/)?.[1]);
}
export function allowsServerMeasurement(headers: Headers) {
  const region = privacyRegion(headers);
  return isToolAllowed('ga4', region.consent_region, choice(headers).accepted, region.gpc);
}
export function allowsServerAdvertisingMeasurement(headers: Headers) {
  return allowsAdvertisingMeasurement(privacyRegion(headers), choice(headers));
}
