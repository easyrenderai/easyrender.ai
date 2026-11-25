// The browser calls that carry a BotID challenge. The client (`instrumentation-client.ts`) attaches
// the proof to exactly these requests and the server (`lib/bot-check.ts`) verifies it on the same
// ones. Basic is free; Deep Analysis is billed per call, so the level is pinned on both sides
// (they have to match) instead of following the project setting in the Vercel dashboard.
export const BOTID_CHECK_LEVEL = 'basic' as const;

export const BOTID_PROTECTED_ROUTES = [
  // Sign-up and sign-in (Better Auth).
  { path: '/api/auth/sign-up/email', method: 'POST' },
  { path: '/api/auth/sign-in/email', method: 'POST' },
  // The free preview: each one is a real sheet generation.
  { path: '/api/renders', method: 'POST' },
].map((route) => ({ ...route, advancedOptions: { checkLevel: BOTID_CHECK_LEVEL } }));
