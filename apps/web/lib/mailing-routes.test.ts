import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  dispatch: vi.fn(),
  user: vi.fn(),
  status: vi.fn(),
  subscribe: vi.fn(),
  stop: vi.fn(),
  confirm: vi.fn(),
  unsubscribe: vi.fn(),
  webhook: vi.fn(),
  run: vi.fn(),
  report: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('next/server', async (original) => ({
  ...(await original<typeof import('next/server')>()),
  after: mocks.after,
}));
vi.mock('@/lib/actor', () => ({ currentUser: mocks.user }));
vi.mock('@/lib/mailing', () => ({
  mailingCatalog: {},
  mailingSystemCopies: {},
  mailingOriginMap: {},
}));
vi.mock('@easyrender/core', () => ({
  AppError: class extends Error {
    constructor(
      message: string,
      public status: number,
      public code: string,
    ) {
      super(message);
    }
  },
  reportError: mocks.report,
  dispatchMailingConfirmation: mocks.dispatch,
  mailingStatus: mocks.status,
  requestMailing: mocks.subscribe,
  stopMailing: mocks.stop,
  confirmMailing: mocks.confirm,
  unsubscribeMailing: mocks.unsubscribe,
  handleMailingWebhook: mocks.webhook,
  runMailing: mocks.run,
}));

import { GET as cron } from '@/app/api/cron/email/route';
import { POST as confirm } from '@/app/api/email/confirm/route';
import { GET as getPreferences, POST as preferences } from '@/app/api/email/preferences/route';
import { POST as unsubscribe } from '@/app/api/email/unsubscribe/route';
import { POST as webhook } from '@/app/api/webhooks/email/route';

function request(path: string, body: string, headers: Record<string, string> = {}) {
  return new Request(`https://easyrender.test${path}`, {
    method: 'POST',
    body,
    headers: { origin: 'https://easyrender.test', 'content-type': 'application/json', ...headers },
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: 'user-1' });
  mocks.status.mockResolvedValue({
    status: 'none',
    locale: null,
    expiresAt: '2026-12-01T00:00:00Z',
    isAvailable: true,
  });
  mocks.confirm.mockResolvedValue(true);
  mocks.unsubscribe.mockResolvedValue(true);
});
describe('mailing preferences transport', () => {
  it('requires a browser session and same-origin JSON for consent', async () => {
    expect(
      (await preferences(request('/api/email/preferences', '{}', { origin: 'https://other.test' })))
        .status,
    ).toBe(403);
    expect(
      (await preferences(request('/api/email/preferences', '{}', { origin: '' }))).status,
    ).toBe(403);
    mocks.user.mockResolvedValue(null);
    expect((await preferences(request('/api/email/preferences', '{}'))).status).toBe(401);
    expect((await getPreferences()).status).toBe(401);
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });
  it('never infers an email language and rejects invalid input', async () => {
    for (const body of [
      '{',
      '{}',
      '{"intent":"subscribe","locale":"de","timezone":"UTC"}',
      '{"intent":"subscribe","locale":"es","timezone":"invalid"}',
    ]) {
      expect((await preferences(request('/api/email/preferences', body))).status).toBe(400);
    }
    expect(
      (await preferences(request('/api/email/preferences', '{}', { 'content-type': 'text/plain' })))
        .status,
    ).toBe(415);
    expect((await preferences(request('/api/email/preferences', 'x'.repeat(17000)))).status).toBe(
      413,
    );
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });
  it('requests confirmation only after explicit subscribe and returns a private status', async () => {
    const response = await preferences(
      request(
        '/api/email/preferences',
        JSON.stringify({ intent: 'subscribe', locale: 'es', timezone: 'Europe/Madrid' }),
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.after).toHaveBeenCalledOnce();
    expect(mocks.subscribe).toHaveBeenCalledWith(
      'user-1',
      { locale: 'es', timezone: 'Europe/Madrid' },
      {},
      {},
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.has('access-control-allow-origin')).toBe(false);
    expect(
      (await preferences(request('/api/email/preferences', '{"intent":"unsubscribe"}'))).status,
    ).toBe(200);
    expect(mocks.stop).toHaveBeenCalledWith('user-1');
  });
});
describe('mailing token routes and delivery', () => {
  it('confirmation needs an explicit same-origin POST and a valid token', async () => {
    expect(
      (await confirm(request('/api/email/confirm', '{"token":"example"}', { origin: '' }))).status,
    ).toBe(403);
    expect((await confirm(request('/api/email/confirm', '{}'))).status).toBe(400);
    mocks.confirm.mockResolvedValue(false);
    expect((await confirm(request('/api/email/confirm', '{"token":"expired"}'))).status).toBe(400);
  });
  it('supports authenticated RFC 8058 POST without Origin but rejects arbitrary cross-origin posts', async () => {
    const response = await unsubscribe(
      request('/api/email/unsubscribe?token=signed-token', 'List-Unsubscribe=One-Click', {
        origin: '',
        'content-type': 'application/x-www-form-urlencoded',
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.unsubscribe).toHaveBeenCalledWith('signed-token');
    expect(
      (
        await unsubscribe(
          request('/api/email/unsubscribe?token=signed-token', 'other=value', {
            origin: '',
            'content-type': 'application/x-www-form-urlencoded',
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await unsubscribe(
          request('/api/email/unsubscribe', '{"token":"signed-token"}', {
            origin: 'https://other.test',
          }),
        )
      ).status,
    ).toBe(403);
  });
  it('keeps webhook bytes unchanged and cron closed without its configured secret', async () => {
    const raw = '{ "type": "email.delivered" }\n';
    const r = request('/api/webhooks/email', raw, { 'svix-signature': 'signature' });
    expect((await webhook(r)).status).toBe(200);
    expect(mocks.webhook).toHaveBeenCalledWith(raw, r.headers);
    const previous = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    expect((await cron(new Request('https://easyrender.test/api/cron/email'))).status).toBe(401);
    process.env.CRON_SECRET = 'test-secret';
    expect(
      (
        await cron(
          new Request('https://easyrender.test/api/cron/email', {
            headers: { authorization: 'Bearer wrong' },
          }),
        )
      ).status,
    ).toBe(401);
    mocks.run.mockResolvedValue({ queued: 1, examined: 2 });
    const accepted = await cron(
      new Request('https://easyrender.test/api/cron/email', {
        headers: { authorization: 'Bearer test-secret' },
      }),
    );
    expect(await accepted.json()).toEqual({ queued: 1, examined: 2 });
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  });
});
