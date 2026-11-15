import { AppError, exchangeCode } from '@easyrender/core';
import { json, oauthError, preflight } from '@/lib/oauth-http';

// Authorization code + PKCE exchange. The access token is an easyrender API key.
export async function POST(request: Request) {
  try {
    const form = new URLSearchParams(await request.text());
    if (form.get('grant_type') !== 'authorization_code') {
      throw new AppError('Only authorization_code is supported', 400, 'unsupported_grant_type');
    }
    if (form.getAll('resource').length > 1) {
      throw new AppError('Only one resource is supported', 400, 'invalid_target');
    }
    return json(
      await exchangeCode({
        code: form.get('code'),
        clientId: form.get('client_id'),
        redirectUri: form.get('redirect_uri'),
        codeVerifier: form.get('code_verifier'),
        resource: form.get('resource'),
      }),
    );
  } catch (error) {
    return oauthError(error);
  }
}

export const OPTIONS = preflight;
