import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  report: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('botid/server', () => ({ checkBotId: mocks.check }));
vi.mock('@easyrender/core', () => {
  class AppError extends Error {
    constructor(
      message: string,
      readonly status: number,
      readonly code: string,
    ) {
      super(message);
    }
  }
  return { AppError, reportError: mocks.report };
});

import { assertNotBot, isBlockedBot } from '@/lib/bot-check';
import { BOTID_CHECK_LEVEL, BOTID_PROTECTED_ROUTES } from '@/lib/botid-routes';

beforeEach(() => {
  mocks.check.mockReset();
  mocks.report.mockReset();
});

describe('BotID check', () => {
  it('lets a person through and blocks an unverified bot', async () => {
    mocks.check.mockResolvedValueOnce({ isBot: false, isVerifiedBot: false });
    expect(await isBlockedBot()).toBe(false);
    mocks.check.mockResolvedValueOnce({ isBot: true, isVerifiedBot: false });
    expect(await isBlockedBot()).toBe(true);
  });

  it('lets a verified bot through', async () => {
    mocks.check.mockResolvedValueOnce({ isBot: true, isVerifiedBot: true });
    expect(await isBlockedBot()).toBe(false);
  });

  it('asks for the free Basic level, the same one the browser is told to solve', async () => {
    mocks.check.mockResolvedValue({ isBot: false, isVerifiedBot: false });
    await isBlockedBot();
    expect(mocks.check).toHaveBeenCalledWith({ advancedOptions: { checkLevel: 'basic' } });
    for (const route of BOTID_PROTECTED_ROUTES)
      expect(route.advancedOptions.checkLevel, route.path).toBe(BOTID_CHECK_LEVEL);
  });

  it('lets the request through and reports when the check itself fails', async () => {
    mocks.check.mockRejectedValueOnce(new Error('OIDC token missing'));
    expect(await isBlockedBot()).toBe(false);
    expect(mocks.report).toHaveBeenCalledTimes(1);
  });

  it('answers a blocked browser with a 403 the web client can translate', async () => {
    mocks.check.mockResolvedValueOnce({ isBot: true, isVerifiedBot: false });
    await expect(assertNotBot({ isApiCaller: false })).rejects.toMatchObject({
      status: 403,
      code: 'bot_detected',
    });
  });

  it('does not check a caller that authenticated with an API key or OAuth token', async () => {
    mocks.check.mockResolvedValue({ isBot: true, isVerifiedBot: false });
    await expect(assertNotBot({ isApiCaller: true })).resolves.toBeUndefined();
    expect(mocks.check).not.toHaveBeenCalled();
  });

  it('protects sign-up, sign-in and the free-preview upload, and nothing else', () => {
    expect(BOTID_PROTECTED_ROUTES.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'POST /api/auth/sign-up/email',
      'POST /api/auth/sign-in/email',
      'POST /api/renders',
    ]);
  });
});
