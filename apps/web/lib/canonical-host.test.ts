import { describe, expect, it } from 'vitest';
import { canonicalHostTarget } from './canonical-host';

const STAGED = 'easyrender-abc123-shipshitdev.vercel.app';

type Input = Parameters<typeof canonicalHostTarget>[0];

/** A GET on `host` (path included), as a production build sees it. */
function get(host: string, path = '/', overrides: Partial<Input> = {}) {
  return canonicalHostTarget({
    method: 'GET',
    url: `https://${host}${path}`,
    host,
    vercelEnv: 'production',
    deploymentHost: STAGED,
    ...overrides,
  });
}

describe('canonicalHostTarget', () => {
  it('answers on the canonical host', () => {
    expect(get('easyrender.ai')).toBeNull();
  });

  it('answers on the staged deployment own host, so the release smoke sees a 200', () => {
    expect(get(STAGED)).toBeNull();
    expect(get(STAGED.toUpperCase())).toBeNull();
  });

  it('keeps redirecting www and aliases of the production deployment', () => {
    expect(get('www.easyrender.ai', '/pricing?x=1')).toBe('https://easyrender.ai/pricing?x=1');
    expect(get('easyrenderai.vercel.app', '/es')).toBe('https://easyrender.ai/es');
  });

  it('sends the retired Spanish landing to /es', () => {
    expect(get('easyrender-landing.vercel.app')).toBe('https://easyrender.ai/es');
  });

  it('redirects every other host when VERCEL_URL is unset', () => {
    expect(get(STAGED, '/', { deploymentHost: undefined })).toBe('https://easyrender.ai/');
  });

  it('leaves previews, API calls and non-GET requests alone', () => {
    expect(get('www.easyrender.ai', '/', { vercelEnv: 'preview' })).toBeNull();
    expect(get('www.easyrender.ai', '/', { vercelEnv: undefined })).toBeNull();
    expect(get('www.easyrender.ai', '/', { method: 'POST' })).toBeNull();
    expect(get('www.easyrender.ai', '/api/openapi.json')).toBeNull();
  });
});
