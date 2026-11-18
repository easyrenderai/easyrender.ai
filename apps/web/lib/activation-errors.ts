import { useTranslations } from 'next-intl';

const keys = {
  bad_image: 'unreadable',
  bad_type: 'photoType',
  too_large: 'large',
  photo_too_large: 'large',
  photo_too_small: 'small',
  photo_aspect: 'aspect',
  photo_blank: 'blank',
  preview_limit: 'previewLimit',
  concurrent_limit: 'concurrentLimit',
  insufficient_credits: 'insufficientCredits',
  sign_in: 'signIn',
  unauthorized: 'signIn',
  trial_verify_email: 'verifyEmail',
  trial_unavailable: 'offerUnavailable',
  bad_state: 'staleState',
  rate_limit: 'rateLimit',
} as const;

export function activationErrorKey(data: unknown) {
  if (typeof data !== 'object' || data === null || !('code' in data)) return null;
  const { code } = data;
  return typeof code === 'string' && Object.hasOwn(keys, code)
    ? keys[code as keyof typeof keys]
    : null;
}

export function useActivationError() {
  const t = useTranslations('ActivationErrors');
  return (value: unknown, fallback: string) => {
    const key = activationErrorKey(value);
    return key ? t(key) : fallback;
  };
}
