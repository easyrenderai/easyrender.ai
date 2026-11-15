import { CONFIG_VERSION } from '@easyrender/core/attribution';
export type ConsentChoice = { accepted: boolean | null; advertising: boolean };
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
