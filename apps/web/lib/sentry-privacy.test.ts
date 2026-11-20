import * as Sentry from '@sentry/nextjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TOKEN = 'a1b2c3d4-0000-4000-8000-5ec2e7000001';
const ORIGIN = 'https://easyrender.ai';

// Every private link, with the name Next gives its transaction. better-auth serves its two links
// from one catch-all route, so there the name says nothing and only the URL identifies the page.
const PRIVATE_REQUESTS = [
  { path: `/invite/${TOKEN}`, name: 'GET /invite/[id]' },
  { path: `/verify-email?token=${TOKEN}`, name: 'GET /verify-email' },
  { path: `/reset-password?token=${TOKEN}`, name: 'GET /reset-password' },
  { path: `/email/confirm?token=${TOKEN}`, name: 'GET /email/confirm' },
  { path: `/email/unsubscribe?token=${TOKEN}`, name: 'GET /email/unsubscribe' },
  { path: `/api/email/confirm?token=${TOKEN}`, name: 'GET /api/email/confirm' },
  { path: `/api/email/unsubscribe?token=${TOKEN}`, name: 'POST /api/email/unsubscribe' },
  { path: `/api/email/verify-account?token=${TOKEN}`, name: 'GET /api/email/verify-account' },
  { path: `/api/auth/verify-email?token=${TOKEN}`, name: 'GET /api/auth/[...all]' },
  { path: `/api/auth/reset-password/${TOKEN}`, name: 'GET /api/auth/[...all]' },
];

// Each init adds the SDK's process listeners; this suite starts it once per case.
process.setMaxListeners(0);

let envelopes: string[] = [];

// Release health sessions (sent whenever a release is set, as in CI) carry no URL, so they are not
// telemetry about a request.
const requestTelemetry = () =>
  envelopes.filter((envelope) => !envelope.includes('"type":"session"'));

// Runs the real SDK with the app's own config file, but swaps the network for a recorder.
vi.mock('@sentry/nextjs', async (importOriginal) => {
  const real = await importOriginal<typeof import('@sentry/nextjs')>();
  return {
    ...real,
    // Only the browser build has it; instrumentation-client.ts re-exports it.
    captureRouterTransitionStart: () => undefined,
    init: (options: Parameters<typeof real.init>[0]) =>
      real.init({
        ...options,
        dsn: 'https://key@example.ingest.sentry.io/1',
        tracesSampleRate: 1,
        transport: () => ({
          send: async (envelope: unknown) => {
            envelopes.push(JSON.stringify(envelope));
            return {};
          },
          flush: async () => true,
        }),
      }),
  };
});

/** One traced request, the way the SDK's HTTP instrumentation records it. */
async function traceRequest(request: { path: string; name: string }) {
  Sentry.startSpan(
    {
      name: request.name,
      op: 'http.server',
      attributes: {
        'url.full': `${ORIGIN}${request.path}`,
        'url.path': request.path.split('?')[0],
        'http.url': `${ORIGIN}${request.path}`,
        'http.target': request.path,
      },
    },
    () => {
      Sentry.addBreadcrumb({ category: 'fetch', data: { url: `${ORIGIN}${request.path}` } });
    },
  );
  await Sentry.flush(2000);
}

const CONFIGS = [
  { runtime: 'server', file: '../sentry.server.config' },
  { runtime: 'edge', file: '../sentry.edge.config' },
  { runtime: 'client', file: '../instrumentation-client' },
] as const;

async function loadConfig(file: (typeof CONFIGS)[number]['file'], href: string) {
  vi.resetModules();
  vi.stubGlobal('window', { location: { href } });
  vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://key@example.ingest.sentry.io/1');
  if (file === '../sentry.server.config') await import('../sentry.server.config');
  else if (file === '../sentry.edge.config') await import('../sentry.edge.config');
  else await import('../instrumentation-client');
}

describe('tracing never reaches Sentry with a private link', () => {
  beforeEach(() => {
    envelopes = [];
  });
  afterEach(async () => {
    await Sentry.close(1000);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('is a real regression: with the SDK default the old hooks never ran', async () => {
    const { filterMailingTelemetry } = await import('./mailing-privacy');
    Sentry.init({
      beforeSendTransaction: filterMailingTelemetry,
      dsn: 'https://key@example.ingest.sentry.io/1',
      tracesSampleRate: 1,
      transport: () => ({
        send: async (envelope: unknown) => {
          envelopes.push(JSON.stringify(envelope));
          return {};
        },
        flush: async () => true,
      }),
    });
    await traceRequest(PRIVATE_REQUESTS[1]);
    expect(envelopes.join('')).toContain(TOKEN);
  });

  for (const { runtime, file } of CONFIGS) {
    describe(`${runtime} config`, () => {
      for (const request of PRIVATE_REQUESTS) {
        it(`sends nothing for ${request.path.replace(TOKEN, ':token')}`, async () => {
          // The browser decides by the page it is on; the servers by the request.
          await loadConfig(file, runtime === 'client' ? '/account' : `${ORIGIN}${request.path}`);
          await traceRequest(request);
          expect(envelopes.join('')).not.toContain(TOKEN);
          expect(requestTelemetry()).toEqual([]);
        });
      }

      it('still sends an ordinary request, with a stray token redacted', async () => {
        await loadConfig(file, `${ORIGIN}/account`);
        await traceRequest({ path: `/account?token=${TOKEN}&tab=billing`, name: 'GET /account' });
        const sent = envelopes.join('');
        expect(sent).toContain('GET /account');
        expect(sent).not.toContain(TOKEN);
        expect(sent).toContain('token=[Filtered]');
      });
    });
  }
});
