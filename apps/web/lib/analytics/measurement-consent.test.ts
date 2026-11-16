import { CONFIG_VERSION } from '@easyrender/core/attribution';
import { expect, it } from 'vitest';
import { allowsServerMeasurement } from './measurement-consent';

const cookie = (accepted: boolean) =>
  `er_consent=${encodeURIComponent(JSON.stringify({ version: CONFIG_VERSION, date: new Date().toISOString(), accepted }))}`;
it('requires a valid explicit choice in strict/unknown regions and honors rejection/GPC everywhere', () => {
  expect(allowsServerMeasurement(new Headers({ 'x-vercel-ip-country': 'ES' }))).toBe(false);
  expect(
    allowsServerMeasurement(new Headers({ 'x-vercel-ip-country': 'ES', cookie: cookie(true) })),
  ).toBe(true);
  expect(
    allowsServerMeasurement(new Headers({ 'x-vercel-ip-country': 'US', cookie: cookie(false) })),
  ).toBe(false);
  expect(
    allowsServerMeasurement(
      new Headers({ 'x-vercel-ip-country': 'US', 'sec-gpc': '1', cookie: cookie(true) }),
    ),
  ).toBe(false);
  expect(allowsServerMeasurement(new Headers({ 'x-vercel-ip-country': 'US' }))).toBe(true);
});

it('advertising measurement needs a separate explicit choice, never inferred from analytics or region', async () => {
  const { allowsServerAdvertisingMeasurement } = await import('./measurement-consent');
  const withChoice = (advertising: boolean, accepted = true) =>
    new Headers({
      'x-vercel-ip-country': 'US',
      cookie: `er_consent=${encodeURIComponent(JSON.stringify({ version: CONFIG_VERSION, date: new Date().toISOString(), accepted, advertising }))}`,
    });
  expect(allowsServerAdvertisingMeasurement(new Headers({ 'x-vercel-ip-country': 'US' }))).toBe(
    false,
  );
  expect(allowsServerAdvertisingMeasurement(new Headers({ cookie: cookie(true) }))).toBe(false);
  expect(allowsServerAdvertisingMeasurement(withChoice(true))).toBe(true);
  expect(allowsServerAdvertisingMeasurement(withChoice(false))).toBe(false);
  expect(allowsServerAdvertisingMeasurement(withChoice(true, false))).toBe(false);
  const gpc = withChoice(true);
  gpc.set('sec-gpc', '1');
  expect(allowsServerAdvertisingMeasurement(gpc)).toBe(false);
});
