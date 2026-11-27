import { memoryAdapter } from 'better-auth/adapters/memory';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  available: true,
  hasQueueFailure: false,
  report: vi.fn(),
  recorded: [] as Array<{ userId: string; code: unknown }>,
  rewarded: [] as string[],
  queued: [] as Array<{
    purpose: string;
    userId: string;
    email: string;
    url: string;
    expiresAt: Date;
    locale: string;
  }>,
  database: { user: [], account: [], session: [], verification: [] } as Record<
    string,
    Record<string, unknown>[]
  >,
  scheduled: [] as Array<() => Promise<void>>,
  botVerdict: { isBot: false, isVerifiedBot: false } as { isBot: boolean; isVerifiedBot: boolean },
}));
vi.mock('botid/server', () => ({ checkBotId: async () => mocks.botVerdict }));
vi.mock('server-only', () => ({}));
vi.mock('@better-auth/infra', () => ({ dash: () => ({ id: 'test-no-dashboard' }) }));
vi.mock('@easyrender/db', () => ({ db: () => ({}) }));
vi.mock('better-auth/adapters/prisma', () => ({
  prismaAdapter: () => memoryAdapter(mocks.database),
}));
vi.mock('@easyrender/core', () => ({
  signupAttribution: async () => {},
  REFERRAL_COOKIE: 'er_ref',
  recordReferral: async (input: { userId: string; code: unknown }) => {
    mocks.recorded.push(input);
  },
  rewardReferral: async (userId: string) => {
    mocks.rewarded.push(userId);
  },
  serviceEmailAvailable: () => mocks.available,
  queueServiceEmail: async (mail: (typeof mocks.queued)[number]) => {
    if (mocks.hasQueueFailure) throw new Error('SENSITIVE queue detail must not be reported');
    mocks.queued.push(mail);
  },
  runServiceEmails: async () => ({ examined: 0 }),
  reportError: mocks.report,
}));
vi.mock('next/server', () => ({
  after: (fn: () => Promise<void>) => {
    mocks.scheduled.push(fn);
  },
}));

beforeAll(async () => {
  vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3100');
  vi.stubEnv('APP_URL', 'http://localhost:3100');
  vi.stubEnv('BETTER_AUTH_SECRET', 'only-for-local-auth-unit-tests-0123456789');
  // Load the auth module graph here, not inside the first test: a cold import on a busy CI runner
  // took longer than the 5s test limit and failed that test (#400, #404 and the v0.5.3 release).
  await import('@/lib/auth');
}, 30_000);
afterAll(() => vi.unstubAllEnvs());
async function request(
  path: string,
  body: Record<string, unknown>,
  extra: Record<string, string> = {},
) {
  const { auth } = await import('@/lib/auth');
  return auth().handler(
    new Request(`http://localhost:3100/api/auth/${path}`, {
      method: 'POST',
      headers: { origin: 'http://localhost:3100', 'content-type': 'application/json', ...extra },
      body: JSON.stringify(body),
    }),
  );
}
describe('service email integration with real Better Auth handlers', () => {
  it('queues a canonical verification without blocking signup/session or requiring verified sign-in', async () => {
    const response = await request(
      'sign-up/email',
      { email: 'local-auth@example.invalid', name: 'Test', password: 'local-password-123' },
      { 'x-easyrender-email-locale': 'es', cookie: 'er_anon=a; er_ref=K7M2PX9Q' },
    );
    expect(response.status).toBe(200);
    expect((await response.json()).user.emailVerified).toBe(false);
    // The referral code comes from the cookie a share link set, and nothing is paid yet.
    expect(mocks.recorded).toMatchObject([{ code: 'K7M2PX9Q' }]);
    expect(mocks.rewarded).toEqual([]);
    expect(response.headers.get('set-cookie')).toContain('session_token');
    expect(mocks.queued).toHaveLength(1);
    expect(mocks.queued[0]).toMatchObject({ purpose: 'verify_email', locale: 'es' });
    expect(new URL(mocks.queued[0].url).pathname).toBe('/verify-email');
    expect(new URL(mocks.queued[0].url).origin).toBe('http://localhost:3100');
    expect(
      (
        await request('sign-in/email', {
          email: 'local-auth@example.invalid',
          password: 'local-password-123',
        })
      ).status,
    ).toBe(200);
  });
  it('returns the same recovery response for existing and unknown accounts, with durable enqueue only for existing', async () => {
    const count = mocks.queued.length;
    const existing = await request(
      'request-password-reset',
      {
        email: 'local-auth@example.invalid',
        redirectTo: 'http://localhost:3100/reset-password',
      },
      {
        'x-easyrender-email-locale': 'fr',
        'x-easyrender-project-return': '/r/local-project',
      },
    );
    const unknown = await request('request-password-reset', {
      email: 'missing@example.invalid',
      redirectTo: 'http://localhost:3100/reset-password',
    });
    expect(existing.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(await existing.json()).toEqual(await unknown.json());
    expect(mocks.queued).toHaveLength(count + 1);
    expect(mocks.queued.at(-1)?.purpose).toBe('reset_password');
    const reset = new URL(mocks.queued.at(-1)?.url ?? '');
    expect(reset.pathname).toBe('/reset-password');
    expect(reset.searchParams.get('locale')).toBe('fr');
    expect(reset.searchParams.get('next')).toBe('/r/local-project');
  });
  it('rejects external recovery redirects and makes disabled delivery truthful for every address', async () => {
    const external = await request('request-password-reset', {
      email: 'local-auth@example.invalid',
      redirectTo: 'https://evil.invalid/reset-password',
    });
    expect(external.status).toBe(403);
    mocks.available = false;
    for (const email of ['local-auth@example.invalid', 'missing@example.invalid']) {
      const result = await request('request-password-reset', { email });
      expect(result.status).toBe(503);
    }
    mocks.available = true;
  });
  it('verifies the queued token and rejects invalid proof without auto-signing in', async () => {
    const { auth } = await import('@/lib/auth');
    const mail = mocks.queued.find((m) => m.purpose === 'verify_email');
    const token = new URL(mail?.url ?? '').searchParams.get('token');
    const result = await auth().handler(
      new Request(`http://localhost:3100/api/auth/verify-email?token=${token}`),
    );
    expect(result.status).toBe(200);
    expect(
      mocks.database.user.find((u) => u.email === 'local-auth@example.invalid')?.emailVerified,
    ).toBe(true);
    expect(result.headers.get('set-cookie') ?? '').not.toContain('session_token');
    // Verifying the email is what releases a pending referral reward.
    const verified = mocks.database.user.find((u) => u.email === 'local-auth@example.invalid');
    expect(mocks.rewarded).toEqual([verified?.id]);
    expect(
      (
        await auth().handler(
          new Request('http://localhost:3100/api/auth/verify-email?token=invalid'),
        )
      ).status,
    ).toBe(401);
  });
  it('rate limits recovery requests even when no account matches', async () => {
    let last: Response | undefined;
    for (let i = 0; i < 6; i++)
      last = await request(
        'request-password-reset',
        { email: 'no-account@example.invalid' },
        { 'x-forwarded-for': '192.0.2.10' },
      );
    expect(last?.status).toBe(429);
  });
  it('resets once, revokes prior sessions and rejects reused or expired tokens', async () => {
    const mail = mocks.queued.findLast((m) => m.purpose === 'reset_password');
    expect(mail).toBeDefined();
    const token = new URL(mail?.url ?? '').searchParams.get('token');
    expect(JSON.stringify(mocks.database.verification)).not.toContain(token);
    const reset = await request('reset-password', {
      token,
      newPassword: 'replacement-password-123',
    });
    expect(reset.status).toBe(200);
    expect(mocks.database.session).toHaveLength(0);
    expect(
      (await request('reset-password', { token, newPassword: 'another-password-123' })).status,
    ).toBe(400);
    expect(
      (
        await request('sign-in/email', {
          email: 'local-auth@example.invalid',
          password: 'local-password-123',
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await request('sign-in/email', {
          email: 'local-auth@example.invalid',
          password: 'replacement-password-123',
        })
      ).status,
    ).toBe(200);
    await request('request-password-reset', { email: 'local-auth@example.invalid' });
    const expired = new URL(mocks.queued.at(-1)?.url ?? '').searchParams.get('token');
    for (const row of mocks.database.verification ?? [])
      if (row.value === mail?.userId) row.expiresAt = new Date(0);
    expect(
      (await request('reset-password', { token: expired, newPassword: 'expired-password-123' }))
        .status,
    ).toBe(400);
  });
  it('keeps signup and recovery generic during queue failure, reporting only safe diagnostics', async () => {
    mocks.hasQueueFailure = true;
    const signup = await request('sign-up/email', {
      email: 'queue-failure@example.invalid',
      name: 'Test',
      password: 'local-password-123',
    });
    expect(signup.status).toBe(200);
    expect(signup.headers.get('set-cookie')).toContain('session_token');
    const existing = await request(
      'request-password-reset',
      { email: 'queue-failure@example.invalid' },
      { 'x-forwarded-for': '192.0.2.30' },
    );
    const unknown = await request(
      'request-password-reset',
      { email: 'still-missing@example.invalid' },
      { 'x-forwarded-for': '192.0.2.30' },
    );
    expect(existing.status).toBe(200);
    expect(await existing.json()).toEqual(await unknown.json());
    expect(mocks.report).toHaveBeenCalled();
    for (const [error] of mocks.report.mock.calls) expect(String(error)).not.toContain('SENSITIVE');
    mocks.hasQueueFailure = false;
  });
  it('requires an authenticated account for manual verification resend', async () => {
    const result = await request('send-verification-email', {
      email: 'queue-failure@example.invalid',
    });
    expect(result.status).toBe(401);
  });

  it('permits only the signed-in address and reports an unavailable manual resend honestly', async () => {
    const login = await request(
      'sign-in/email',
      { email: 'queue-failure@example.invalid', password: 'local-password-123' },
      { 'x-forwarded-for': '192.0.2.60' },
    );
    expect(login.status).toBe(200);
    const cookie = login.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');
    const headers = { cookie, 'x-forwarded-for': '192.0.2.61' };
    for (const email of ['local-auth@example.invalid', 'another-missing@example.invalid'])
      expect((await request('send-verification-email', { email }, headers)).status).toBe(403);
    mocks.hasQueueFailure = true;
    expect(
      (
        await request(
          'send-verification-email',
          { email: 'queue-failure@example.invalid' },
          headers,
        )
      ).status,
    ).toBe(503);
    mocks.hasQueueFailure = false;
  });
  it('refuses a sign-up or sign-in that BotID calls a bot, before any account or session exists', async () => {
    const users = mocks.database.user.length;
    const queued = mocks.queued.length;
    const ip = { 'x-forwarded-for': '192.0.2.77' };
    mocks.botVerdict = { isBot: true, isVerifiedBot: false };
    try {
      const signup = await request(
        'sign-up/email',
        {
          email: 'bot-farm@example.invalid',
          name: 'Bot',
          password: 'local-password-123',
        },
        ip,
      );
      expect(signup.status).toBe(403);
      expect((await signup.json()).code).toBe('BOT_DETECTED');
      expect(signup.headers.get('set-cookie')).toBeNull();
      expect(mocks.database.user).toHaveLength(users);
      expect(mocks.queued).toHaveLength(queued);
      const signin = await request(
        'sign-in/email',
        {
          email: 'local-auth@example.invalid',
          password: 'local-password-123',
        },
        ip,
      );
      expect(signin.status).toBe(403);
      expect(signin.headers.get('set-cookie')).toBeNull();
    } finally {
      mocks.botVerdict = { isBot: false, isVerifiedBot: false };
    }
  });
});
