import {
  isReferralCode,
  normalizeReferralCode,
  REFERRAL_COOKIE,
  referralBonusCredits,
} from '@easyrender/core';
import { cookies } from 'next/headers';
import { apiHandle, apiOptions } from '@/lib/api-http';

// What the sign up form shows: the code that will be applied, if there is a real one. The code in
// the URL wins over the one a share link saved earlier. Nothing about the referrer is revealed.
export const GET = (request: Request) =>
  apiHandle(request, async () => {
    const requested = normalizeReferralCode(new URL(request.url).searchParams.get('ref'));
    const saved = normalizeReferralCode((await cookies()).get(REFERRAL_COOKIE)?.value);
    const code = requested ?? saved;
    const isValid = code ? await isReferralCode(code) : false;
    return Response.json(
      { code: isValid ? code : null, credits: referralBonusCredits() },
      { headers: { 'cache-control': 'private, no-store' } },
    );
  });
export const OPTIONS = apiOptions;
