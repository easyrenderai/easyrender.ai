import 'server-only';
import { AppError, reportError } from '@easyrender/core';
import { checkBotId } from 'botid/server';
import { BOTID_CHECK_LEVEL } from '@/lib/botid-routes';

export const BOT_BLOCKED_CODE = 'bot_detected';
export const BOT_BLOCKED_MESSAGE =
  'We could not verify this browser. Reload the page and try again.';

// True when Vercel BotID classifies the current request as an automated client that is not a
// verified bot. Call it only for routes listed in BOTID_PROTECTED_ROUTES, and before anything is
// created or spent.
//
// - Verified bots (Googlebot, AI assistants acting for a person) are named in Vercel's directory
//   and cannot be imitated, so they pass.
// - BotID is a second layer, not a dependency: when the check itself fails (Vercel unreachable, no
//   OIDC token) the request goes through and the failure is reported, like the app-level limits.
export async function isBlockedBot(): Promise<boolean> {
  try {
    const verdict = await checkBotId({ advancedOptions: { checkLevel: BOTID_CHECK_LEVEL } });
    return verdict.isBot && !verdict.isVerifiedBot;
  } catch (error) {
    reportError(error instanceof Error ? error : new Error('BotID check failed'));
    return false;
  }
}

// For route handlers that throw AppError. A caller with a valid API key or OAuth token passes
// `isApiCaller`: it authenticates and rate limits itself, and has no browser to solve a challenge.
export async function assertNotBot({ isApiCaller }: { isApiCaller: boolean }): Promise<void> {
  if (!isApiCaller && (await isBlockedBot()))
    throw new AppError(BOT_BLOCKED_MESSAGE, 403, BOT_BLOCKED_CODE);
}
