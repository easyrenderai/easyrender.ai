import { LEGACY_HOSTS, SITE_HOST } from '@/lib/seo/site';

interface CanonicalHostInput {
  method: string;
  /** The request URL, absolute. */
  url: string;
  /** The Host header. */
  host: string | null;
  /** `process.env.VERCEL_ENV`: only `production` has a canonical host. */
  vercelEnv: string | undefined;
  /** `process.env.VERCEL_URL`: the unique host of the deployment that is answering. */
  deploymentHost: string | undefined;
}

/**
 * Where a request for a non-canonical host must 301, or null to answer it here.
 *
 * Only production builds enforce a host: a preview keeps answering on its own *.vercel.app URL,
 * which is what makes it reviewable. A production build staged with `--skip-domain` (the Release
 * workflow) is only reachable on its own deployment URL, so that one host is let through, or the
 * smoke of `/` could never see a 200. Aliases of the deployment (www, easyrenderai.vercel.app)
 * still redirect: they are never `VERCEL_URL`.
 *
 * Only GET and HEAD: a 301 would turn a webhook POST into a GET and lose its body, and /api is
 * excluded for the same reason.
 */
export function canonicalHostTarget(input: CanonicalHostInput): string | null {
  if (input.vercelEnv !== 'production') return null;
  if (input.method !== 'GET' && input.method !== 'HEAD') return null;

  const requested = new URL(input.url);
  if (requested.pathname.startsWith('/api/')) return null;

  const host = input.host?.split(':')[0]?.toLowerCase();
  if (!host || host === SITE_HOST) return null;
  if (input.deploymentHost && host === input.deploymentHost.toLowerCase()) return null;

  const target = new URL(input.url);
  target.protocol = 'https:';
  target.host = SITE_HOST;
  target.port = '';
  // A retired landing goes to the page that replaced it, not to the same path on the new host.
  const replacement = LEGACY_HOSTS[host];
  if (replacement && requested.pathname === '/') target.pathname = replacement;

  return target.toString();
}
