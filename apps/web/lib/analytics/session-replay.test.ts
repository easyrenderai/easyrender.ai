import type { CaptureResult, PostHogConfig } from 'posthog-js';
import { afterEach, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({ init: vi.fn() }));
vi.mock('posthog-js', () => ({ default: sdk }));
function instance() {
  return {
    capture: vi.fn(),
    reset: vi.fn(),
    startSessionRecording: vi.fn(),
    stopSessionRecording: vi.fn(),
  };
}
function consent(accepted: boolean) {
  // biome-ignore lint/suspicious/noDocumentCookie: mocked document, no browser storage in this fixture.
  document.cookie = `er_consent=${encodeURIComponent(JSON.stringify({ accepted, advertising: false, version: 'v1', date: new Date().toISOString() }))}`;
}
async function browser(path = '/credits') {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'fixture-public-key');
  vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 Chrome/130.0' });
  const location = new URL(`https://easyrender.ai${path}`);
  vi.stubGlobal('window', { location });
  vi.stubGlobal('document', {
    cookie: '',
    referrer: '',
    documentElement: { lang: 'en', dataset: {} },
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 204 })),
  );
  const cookieless = instance();
  const consented = instance();
  sdk.init.mockImplementation((_key, _config, name) =>
    name === 'er_consented' ? consented : cookieless,
  );
  return { api: await import('./browser'), cookieless, consented, location };
}
function config(name: string): Partial<PostHogConfig> {
  return sdk.init.mock.calls.find(([, , instanceName]) => instanceName === name)?.[1];
}
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it('starts masked replay only after an explicit analytics grant, stops on withdrawal, and resumes on regrant', async () => {
  const page = await browser();
  await page.api.setBrowserTools(true, false, false, false, false);
  expect(config('er_cookieless').disable_session_recording).toBe(true);
  expect(page.cookieless.startSessionRecording).not.toHaveBeenCalled();
  consent(true);
  await page.api.setBrowserTools(true, false, false, false, true);
  expect(config('er_consented')).toMatchObject({
    persistence: 'memory',
    disable_persistence: true,
    disable_session_recording: false,
    enable_recording_console_log: false,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '*',
      maskAllElementAttributes: true,
      recordBody: false,
      recordHeaders: false,
      captureCanvas: { recordCanvas: false },
    },
  });
  expect(config('er_consented').session_recording?.blockSelector).toContain('form');
  expect(config('er_consented').session_recording?.blockSelector).toContain('input[type="file"]');
  expect(page.consented.startSessionRecording).toHaveBeenCalledTimes(1);
  const send = config('er_consented').before_send;
  if (typeof send !== 'function') throw new Error('Missing send guard');
  const snapshot: CaptureResult = {
    uuid: 'snapshot-fixture',
    event: '$snapshot',
    properties: { $snapshot_data: [{ type: 3, data: { masked: true } }] },
  };
  expect(send(snapshot)?.properties.$snapshot_data).toEqual(snapshot.properties.$snapshot_data);
  consent(false);
  await page.api.setBrowserTools(true, false, true, false, false);
  expect(page.consented.stopSessionRecording).toHaveBeenCalled();
  expect(page.consented.reset).toHaveBeenCalledWith(true);
  expect(send(snapshot)).toBeNull();
  consent(true);
  await page.api.setBrowserTools(true, false, false, false, true);
  expect(page.consented.startSessionRecording).toHaveBeenCalledTimes(2);
  expect(page.cookieless.startSessionRecording).not.toHaveBeenCalled();
});

it.each(['pending', 'rejected', 'regional default', 'GPC'])(
  'never starts replay for %s',
  async (state) => {
    const page = await browser();
    if (state === 'rejected') consent(false);
    if (state === 'GPC') {
      consent(true);
      vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0', globalPrivacyControl: true });
    }
    await page.api.setBrowserTools(
      true,
      false,
      state === 'rejected',
      false,
      state === 'regional default' || state === 'GPC',
    );
    expect(sdk.init.mock.calls[0][1].disable_session_recording).toBe(true);
    expect(page.cookieless.startSessionRecording).not.toHaveBeenCalled();
    expect(page.consented.startSessionRecording).not.toHaveBeenCalled();
  },
);

it.each([
  '/admin',
  '/admin/analytics',
  '/es/admin',
  '/account',
  '/checkout',
  '/email/confirm?token=private',
  '/invite/private',
  '/reset-password/private',
  '/sign-in?next=%2Finvite%2Fprivate',
])('blocks replay at initialization and during navigation to %s', async (path) => {
  const page = await browser(path);
  consent(true);
  await page.api.setBrowserTools(true, false, false, false, true);
  expect(page.consented.startSessionRecording).not.toHaveBeenCalled();
  expect(sdk.init.mock.calls.every(([, options]) => options.disable_session_recording)).toBe(true);
  page.location.href = 'https://easyrender.ai/credits';
  await page.api.setBrowserTools(true, false, false, false, true);
  expect(page.consented.startSessionRecording).toHaveBeenCalled();
  page.location.href = `https://easyrender.ai${path}`;
  const send = config('er_consented').before_send;
  if (typeof send !== 'function') throw new Error('Missing send guard');
  send({ uuid: 'event-fixture', event: '$pageview', properties: {} });
  expect(page.consented.stopSessionRecording).toHaveBeenCalled();
  expect(
    send({
      uuid: 'event-fixture',
      event: '$snapshot',
      properties: { $snapshot_data: ['private'] },
    }),
  ).toBeNull();
});

it('stops replay when analytics unmounts or is disabled and rejects queued snapshots', async () => {
  const page = await browser();
  consent(true);
  await page.api.setBrowserTools(true, false, false, false, true);
  page.api.stopBrowserSessionReplay();
  expect(page.consented.stopSessionRecording).toHaveBeenCalled();
  await page.api.setBrowserTools(false, false, false, false, true);
  const send = config('er_consented').before_send;
  if (typeof send !== 'function') throw new Error('Missing send guard');
  expect(send({ uuid: 'event-fixture', event: '$snapshot', properties: {} })).toBeNull();
});

it('redacts replay URLs and drops network payloads and sensitive locations', async () => {
  const page = await browser();
  consent(true);
  await page.api.setBrowserTools(true, false, false, false, true);
  const mask = config('er_consented').session_recording?.maskCapturedNetworkRequestFn;
  const timing = { duration: 0, startTime: 0, entryType: 'navigation' };
  expect(
    mask?.({ ...timing, name: 'https://easyrender.ai/credits?email=private&token=secret#private' }),
  ).toEqual({ ...timing, name: 'https://easyrender.ai/credits' });
  expect(
    mask?.({
      ...timing,
      name: 'https://easyrender.ai/api/account',
      method: 'POST',
      requestBody: 'private',
    }),
  ).toBeNull();
  expect(
    mask?.({ ...timing, name: 'https://easyrender.ai/email/confirm?token=private' }),
  ).toBeNull();
});

it('rechecks revoked consent before a queued snapshot even before tools are updated', async () => {
  const page = await browser();
  consent(true);
  await page.api.setBrowserTools(true, false, false, false, true);
  const send = config('er_consented').before_send;
  if (typeof send !== 'function') throw new Error('Missing send guard');
  consent(false);
  expect(send({ uuid: 'queued-snapshot', event: '$snapshot', properties: {} })).toBeNull();
  expect(page.consented.stopSessionRecording).toHaveBeenCalledTimes(1);
});
