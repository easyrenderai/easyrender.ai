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

it('advertising defaults on in standard regions but preserves explicit analytics-only choices', async () => {
  const { allowsServerAdvertisingMeasurement } = await import('./measurement-consent');
  const withChoice = (advertising: boolean, accepted = true) =>
    new Headers({
      'x-vercel-ip-country': 'US',
      cookie: `er_consent=${encodeURIComponent(JSON.stringify({ version: CONFIG_VERSION, date: new Date().toISOString(), accepted, advertising }))}`,
    });
  expect(allowsServerAdvertisingMeasurement(new Headers({ 'x-vercel-ip-country': 'US' }))).toBe(
    true,
  );
  expect(allowsServerAdvertisingMeasurement(new Headers({ cookie: cookie(true) }))).toBe(false);
  expect(allowsServerAdvertisingMeasurement(withChoice(true))).toBe(true);
  expect(allowsServerAdvertisingMeasurement(withChoice(false))).toBe(false);
  expect(allowsServerAdvertisingMeasurement(withChoice(true, false))).toBe(false);
  const gpc = withChoice(true);
  gpc.set('sec-gpc', '1');
  expect(allowsServerAdvertisingMeasurement(gpc)).toBe(false);
});

it.each(['MX', 'US', 'BR', 'AR', 'CO', 'CL'])(
  'allows advertising by default in %s, unless rejected or GPC is present',
  async (country) => {
    const { allowsServerAdvertisingMeasurement } = await import('./measurement-consent');
    const headers = new Headers({ 'x-vercel-ip-country': country });
    expect(allowsServerAdvertisingMeasurement(headers)).toBe(true);
    headers.set('sec-gpc', '1');
    expect(allowsServerAdvertisingMeasurement(headers)).toBe(false);
    headers.delete('sec-gpc');
    headers.set('cookie', cookie(false));
    expect(allowsServerAdvertisingMeasurement(headers)).toBe(false);
    headers.set('cookie', cookie(true));
    expect(allowsServerAdvertisingMeasurement(headers)).toBe(false);
  },
);

it.each(['ES', 'DE', 'FR', 'IT', 'PT', 'GB', 'CH', 'NO', 'XX'])(
  'still requires separate advertising consent in strict/unknown region %s',
  async (country) => {
    const { allowsServerAdvertisingMeasurement } = await import('./measurement-consent');
    const headers = new Headers({ 'x-vercel-ip-country': country });
    expect(allowsServerAdvertisingMeasurement(headers)).toBe(false);
    headers.set('cookie', cookie(true));
    expect(allowsServerAdvertisingMeasurement(headers)).toBe(false);
    headers.set(
      'cookie',
      `er_consent=${encodeURIComponent(JSON.stringify({ version: CONFIG_VERSION, date: new Date().toISOString(), accepted: true, advertising: true }))}`,
    );
    expect(allowsServerAdvertisingMeasurement(headers)).toBe(true);
    headers.set('sec-gpc', '1');
    expect(allowsServerAdvertisingMeasurement(headers)).toBe(false);
  },
);
