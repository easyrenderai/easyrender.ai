import { afterEach, describe, expect, it, vi } from 'vitest';

const init = vi.hoisted(() => vi.fn());
vi.mock('botid/client/core', () => ({ initBotId: init }));
vi.mock('@sentry/nextjs', () => ({ init: vi.fn(), captureRouterTransitionStart: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  init.mockClear();
});

describe('BotID in the browser', () => {
  it('attaches the challenge to sign-up, sign-in and the free-preview upload', async () => {
    vi.stubGlobal('window', { location: { href: 'https://easyrender.ai/' } });
    await import('../instrumentation-client');
    expect(init).toHaveBeenCalledTimes(1);
    expect(init.mock.calls[0][0].protect).toEqual([
      { path: '/api/auth/sign-up/email', method: 'POST', advancedOptions: { checkLevel: 'basic' } },
      { path: '/api/auth/sign-in/email', method: 'POST', advancedOptions: { checkLevel: 'basic' } },
      { path: '/api/renders', method: 'POST', advancedOptions: { checkLevel: 'basic' } },
    ]);
  });
});
