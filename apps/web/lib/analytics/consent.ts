import { CONFIG_VERSION, isToolAllowed, type PrivacyRegion } from '@easyrender/core/attribution';
export type ConsentChoice = { accepted: boolean | null; advertising: boolean };
export function allowsAdvertisingMeasurement(region: PrivacyRegion, choice: ConsentChoice) {
  // No saved choice uses the regional default. Analytics-only (including legacy choices)
  // explicitly opts out of advertising in every region.
  const advertising = choice.accepted === null ? null : choice.accepted && choice.advertising;
  return (
    isToolAllowed('ga4', region.consent_region, choice.accepted, region.gpc) &&
    isToolAllowed('ads', region.consent_region, advertising, region.gpc)
  );
}
export function readConsent(raw: string | undefined, now = Date.now()): ConsentChoice {
  try {
    const value = JSON.parse(decodeURIComponent(raw ?? 'null'));
    const age = now - Date.parse(value?.date);
    if (
      value?.version === CONFIG_VERSION &&
      typeof value.accepted === 'boolean' &&
      age >= 0 &&
      age < 366 * 86400000
    )
      return {
        accepted: value.accepted,
        advertising: value.accepted && value.advertising === true,
      };
  } catch {
    /* Invalid or old choices do not grant optional measurement. */
  }
  return { accepted: null, advertising: false };
}
