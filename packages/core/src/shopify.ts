import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { db } from '@easyrender/db';
import { AppError } from './errors';

// Shopify app plumbing: session-token and webhook verification, token exchange, an encrypted
// store of each shop's Admin API token, and the few Admin GraphQL calls the app makes.
// The app's own pages and routes live in apps/web; the 3D work goes through ./catalog.

// Pinned: a Shopify API version is supported for about a year. Bump it deliberately.
export const SHOPIFY_API_VERSION = '2026-07';
export const SHOPIFY_METAFIELD = { namespace: 'easyrender', key: 'render_id' } as const;

export const shopifyEnv = {
  apiKey: () => process.env.SHOPIFY_API_KEY ?? '',
  apiSecret: () => process.env.SHOPIFY_API_SECRET ?? '',
};

const SHOP_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
export const isShopDomain = (value: unknown): value is string =>
  typeof value === 'string' && SHOP_PATTERN.test(value);

const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

const b64url = (input: Buffer | string) => Buffer.from(input).toString('base64url');

// --- Webhooks ------------------------------------------------------------------------------------

// Shopify signs the raw body with the app secret: base64(HMAC-SHA256(body)).
export function verifyWebhook(
  rawBody: string,
  header: string | null,
  secret = shopifyEnv.apiSecret(),
) {
  if (!header || !secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  return safeEqual(expected, header);
}

// --- Session tokens (App Bridge) -----------------------------------------------------------------

// Verifies the JWT App Bridge gives the embedded page: HS256 with the app secret, for this app,
// from a real shop, not expired. Returns the shop it was issued for.
export function verifySessionToken(
  token: string,
  { apiKey = shopifyEnv.apiKey(), secret = shopifyEnv.apiSecret(), now = Date.now() } = {},
): string {
  const invalid = () => new AppError('Invalid Shopify session', 401, 'bad_session');
  if (!apiKey || !secret)
    throw new AppError('Shopify app is not configured', 503, 'not_configured');
  const parts = token.split('.');
  if (parts.length !== 3) throw invalid();
  const [header, payload, signature] = parts as [string, string, string];
  const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  if (!safeEqual(expected, signature)) throw invalid();
  let claims: {
    alg?: string;
    iss?: string;
    dest?: string;
    aud?: string;
    exp?: number;
    nbf?: number;
  };
  try {
    if (JSON.parse(Buffer.from(header, 'base64url').toString()).alg !== 'HS256') throw invalid();
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch {
    throw invalid();
  }
  const seconds = Math.floor(now / 1000);
  if (claims.aud !== apiKey) throw invalid();
  if (typeof claims.exp !== 'number' || claims.exp + 10 < seconds) throw invalid();
  if (typeof claims.nbf === 'number' && claims.nbf - 10 > seconds) throw invalid();
  const shop = claims.dest?.replace(/^https:\/\//, '');
  if (!isShopDomain(shop) || claims.iss !== `https://${shop}/admin`) throw invalid();
  return shop;
}

export function bearerSessionToken(headers: Headers): string | null {
  const value = headers.get('authorization');
  return value?.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : null;
}

// --- Admin API token, encrypted at rest ----------------------------------------------------------

const encryptionKey = () =>
  createHash('sha256')
    .update(`shopify-token:${process.env.BETTER_AUTH_SECRET ?? ''}`)
    .digest();

export function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64url')).join('.');
}

export function decryptToken(stored: string): string {
  const [iv, tag, data] = stored.split('.').map((part) => Buffer.from(part, 'base64url'));
  if (!iv || !tag || !data)
    throw new AppError('Stored Shopify token is unreadable', 500, 'bad_token');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export type ShopifyGraphqlFetch = typeof fetch;
type Fetch = ShopifyGraphqlFetch;

// Trades the session token for an offline Admin API token (Shopify's token exchange, which needs
// no redirect flow because the app is installed with managed installation).
export async function exchangeSessionToken(
  shop: string,
  sessionToken: string,
  fetchImpl: Fetch = fetch,
): Promise<{ accessToken: string; scope: string }> {
  const response = await fetchImpl(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      client_id: shopifyEnv.apiKey(),
      client_secret: shopifyEnv.apiSecret(),
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      subject_token: sessionToken,
      subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
      requested_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
    }),
  });
  const data = (await response.json().catch(() => null)) as {
    access_token?: string;
    scope?: string;
  } | null;
  if (!response.ok || !data?.access_token) {
    throw new AppError('Shopify refused the install', 502, 'shopify_exchange');
  }
  return { accessToken: data.access_token, scope: data.scope ?? '' };
}

// The shop's stored token, exchanging the session token for one the first time the app opens.
export async function ensureShop(shop: string, sessionToken: string, fetchImpl: Fetch = fetch) {
  const existing = await db().shopifyShop.findUnique({ where: { shop } });
  if (existing) return existing;
  const { accessToken, scope } = await exchangeSessionToken(shop, sessionToken, fetchImpl);
  return db().shopifyShop.upsert({
    where: { shop },
    create: { shop, accessToken: encryptToken(accessToken), scope },
    update: { accessToken: encryptToken(accessToken), scope },
  });
}

// --- Linking a shop to an easyrender account -----------------------------------------------------

const LINK_TTL_MS = 30 * 60 * 1000;

// The merchant opens easyrender.ai in a new tab (the embedded page cannot sign in); this signed
// state proves the link request came from the app for that shop.
export function signLinkState(shop: string, now = Date.now()): string {
  const payload = b64url(JSON.stringify({ shop, exp: now + LINK_TTL_MS }));
  const mac = createHmac('sha256', shopifyEnv.apiSecret()).update(payload).digest('base64url');
  return `${payload}.${mac}`;
}

export function verifyLinkState(state: string | null | undefined, now = Date.now()): string {
  const bad = () =>
    new AppError('This link has expired. Open the app in Shopify again.', 400, 'bad_state');
  const [payload, mac] = (state ?? '').split('.');
  if (!payload || !mac || !shopifyEnv.apiSecret()) throw bad();
  const expected = createHmac('sha256', shopifyEnv.apiSecret()).update(payload).digest('base64url');
  if (!safeEqual(expected, mac)) throw bad();
  try {
    const { shop, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!isShopDomain(shop) || typeof exp !== 'number' || exp < now) throw bad();
    return shop;
  } catch {
    throw bad();
  }
}

export async function linkShop(shop: string, userId: string) {
  const { count } = await db().shopifyShop.updateMany({ where: { shop }, data: { userId } });
  if (count === 0) throw new AppError('Open the app in Shopify first', 404, 'shop_not_installed');
}

// The app was uninstalled: forget the token. The shop's renders stay with the account.
export async function removeShop(shop: string) {
  await db().shopifyShop.deleteMany({ where: { shop } });
  await db().catalogItem.deleteMany({ where: { platform: 'shopify', store: shop } });
}

// --- Admin GraphQL ------------------------------------------------------------------------------

export async function shopifyGraphql<T>(
  shop: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown> = {},
  fetchImpl: Fetch = fetch,
): Promise<T> {
  const response = await fetchImpl(
    `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-shopify-access-token': accessToken },
      body: JSON.stringify({ query, variables }),
    },
  );
  if (response.status === 401 || response.status === 403) {
    throw new AppError('Shopify rejected the app. Reinstall it.', 502, 'shopify_auth');
  }
  const body = (await response.json().catch(() => null)) as {
    data?: T;
    errors?: { message: string }[];
  } | null;
  if (!response.ok || !body?.data || body.errors?.length) {
    throw new AppError(
      `Shopify error: ${body?.errors?.[0]?.message ?? response.status}`,
      502,
      'shopify_graphql',
    );
  }
  return body.data;
}

export type ShopifyProduct = {
  // The numeric id: the catalogue's externalId.
  id: string;
  gid: string;
  title: string;
  imageUrl: string | null;
  renderId: string | null;
};

const PRODUCTS_QUERY = `query Products($after: String) {
  products(first: 100, after: $after, query: "status:active") {
    nodes {
      id
      title
      featuredMedia {
        ... on MediaImage { image { url(transform: { maxWidth: 2048, maxHeight: 2048 }) } }
      }
      metafield(namespace: "${SHOPIFY_METAFIELD.namespace}", key: "${SHOPIFY_METAFIELD.key}") { value }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

type ProductsData = {
  products: {
    nodes: {
      id: string;
      title: string;
      featuredMedia: { image?: { url: string } } | null;
      metafield: { value: string } | null;
    }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

// Every active product with its main photo and the model already on it, if any.
export async function listShopProducts(
  shop: string,
  accessToken: string,
  fetchImpl: Fetch = fetch,
  maxProducts = 5000,
): Promise<ShopifyProduct[]> {
  const out: ShopifyProduct[] = [];
  let after: string | null = null;
  do {
    const data: ProductsData = await shopifyGraphql<ProductsData>(
      shop,
      accessToken,
      PRODUCTS_QUERY,
      { after },
      fetchImpl,
    );
    for (const node of data.products.nodes) {
      out.push({
        id: node.id.split('/').pop() ?? node.id,
        gid: node.id,
        title: node.title,
        imageUrl: node.featuredMedia?.image?.url ?? null,
        renderId: node.metafield?.value || null,
      });
    }
    after = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
  } while (after && out.length < maxProducts);
  return out;
}

const SET_METAFIELDS = `mutation Set($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { id }
    userErrors { field message }
  }
}`;

// Puts each finished model's id on its product, where the theme block reads it. Shopify takes 25
// metafields per call.
export async function writeRenderMetafields(
  shop: string,
  accessToken: string,
  items: { gid: string; renderId: string }[],
  fetchImpl: Fetch = fetch,
): Promise<void> {
  for (let start = 0; start < items.length; start += 25) {
    const metafields = items.slice(start, start + 25).map((item) => ({
      ownerId: item.gid,
      namespace: SHOPIFY_METAFIELD.namespace,
      key: SHOPIFY_METAFIELD.key,
      type: 'single_line_text_field',
      value: item.renderId,
    }));
    const data = await shopifyGraphql<{
      metafieldsSet: { userErrors: { message: string }[] };
    }>(shop, accessToken, SET_METAFIELDS, { metafields }, fetchImpl);
    const error = data.metafieldsSet.userErrors[0];
    if (error) throw new AppError(`Shopify error: ${error.message}`, 502, 'shopify_graphql');
  }
}
