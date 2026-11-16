// Public REST contract. Keep response schemas additive: clients must ignore unknown fields.
type Schema = Record<string, unknown>;
const string: Schema = { type: 'string' };
const nullableString: Schema = { type: ['string', 'null'] };
const integer: Schema = { type: 'integer', minimum: 0 };
const boolean: Schema = { type: 'boolean' };
const date: Schema = { type: 'string', format: 'date-time' };
const binary: Schema = { type: 'string', format: 'binary' };
const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const array = (items: Schema): Schema => ({ type: 'array', items });
const object = (
  properties: Record<string, Schema>,
  required = Object.keys(properties),
): Schema => ({
  type: 'object',
  properties,
  required,
});
const renderStatus = {
  type: 'string',
  enum: ['drafting', 'preview_ready', 'rendering', 'ready', 'failed'],
};
const imageType = { type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp'] };
const urlSource = { type: 'string', format: 'uri', pattern: '^https://', minLength: 1 };
const sourceFields = {
  image: binary,
  upload_id: { type: 'string', minLength: 1 },
  image_url: urlSource,
};
const exclusiveSources = (names: string[]) =>
  names.map((name) => ({
    required: [name],
    not: {
      anyOf: ['image', 'upload_id', 'image_url']
        .filter((other) => other !== name)
        .map((other) => ({ required: [other] })),
    },
  }));
const metadata = { prompt: { type: 'string', maxLength: 500 }, name: string, isPublic: boolean };
const imageSource: Schema = {
  ...object({ ...sourceFields, ...metadata }, []),
  oneOf: exclusiveSources(['image', 'upload_id', 'image_url']),
};
const query = (name: string, schema: Schema, required = false) => ({
  name,
  in: 'query',
  required,
  schema,
});
const id = { name: 'id', in: 'path', required: true, schema: string };
const view = { name: 'view', in: 'path', required: true, schema: string };
const storeQuery = [query('platform', ref('CatalogPlatform'), true), query('store', string, true)];
const jsonBody = (schema: Schema) => ({
  required: true,
  content: { 'application/json': { schema } },
});
const imageBody = {
  required: true,
  content: {
    'multipart/form-data': { schema: ref('CreateRenderMultipart') },
    'application/json': { schema: ref('CreateRenderJson') },
  },
};
const responseHeaders = {
  'X-Request-Id': {
    description: 'Correlation ID; include it when contacting support.',
    schema: string,
  },
};
const errors = Object.fromEntries(
  [400, 401, 402, 403, 404, 409, 413, 415, 422, 429, 500, 502, 503].map((status) => [
    status,
    {
      description:
        status === 429
          ? 'Rate or concurrent-job limit. Respect Retry-After.'
          : 'Request failed; inspect code and retryable.',
      headers: {
        ...responseHeaders,
        ...(status === 429 ? { 'Retry-After': { schema: string } } : {}),
      },
      content: { 'application/json': { schema: ref('Error') } },
    },
  ]),
);
function operation(
  operationId: string,
  summary: string,
  scopes: string[],
  schema: Schema,
  status = 200,
) {
  return {
    operationId,
    summary,
    'x-required-scopes': scopes,
    responses: {
      ...errors,
      [status]: {
        description: 'Success',
        headers: responseHeaders,
        content: { 'application/json': { schema } },
      },
    },
  };
}
function asset(operationId: string, summary: string, mediaType: string, isPublicResource = false) {
  return {
    ...operation(operationId, summary, ['read'], binary),
    ...(isPublicResource ? { security: [{ bearerAuth: [] }, {}] } : {}),
    parameters: [id],
    responses: {
      ...errors,
      200: {
        description: 'Asset bytes; existence of a URL does not guarantee readiness.',
        content: { [mediaType]: { schema: binary } },
      },
    },
  };
}

export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'easyrender API',
    version: '1.0.0',
    description:
      'Photo-to-3D REST contract. Existing /api paths are retained. Long-running jobs return immediately: poll their ID. Amounts are credits unless explicitly labeled as currency. MCP uses /api/mcp and tools/list, not these REST operation IDs. See docs/api.md for safe retry and spending rules.',
  },
  servers: [{ url: 'https://easyrender.ai' }],
  security: [{ bearerAuth: [] }],
  paths: {
    '/api/credits': {
      get: operation(
        'getCredits',
        'Read current balance and account-specific pricing',
        ['read'],
        ref('CreditQuote'),
      ),
    },
    '/api/uploads': {
      post: {
        ...operation(
          'uploadImage',
          'Upload a private image; owner-scoped ID expires after one hour',
          ['write'],
          ref('Upload'),
          201,
        ),
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: object({ image: binary }) } },
        },
      },
    },
    '/api/renders': {
      get: {
        ...operation(
          'listRenders',
          'List owned renders, newest first; does not advance jobs',
          ['read'],
          ref('RenderPage'),
        ),
        parameters: [
          query('limit', { type: 'integer', minimum: 1, maximum: 100, default: 25 }),
          query('cursor', string),
          query('status', renderStatus),
        ],
      },
      post: {
        ...operation(
          'createRender',
          'Create a free preview, private by default for API callers',
          ['write'],
          ref('Render'),
          201,
        ),
        description:
          'Setting isPublic=true additionally requires share. Idempotency-Key is scoped to the user: exact same input reuses the ID; different input returns 409 idempotency_conflict. Keep the same key after a lost response.',
        parameters: [
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: false,
            schema: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[!-~]+$' },
          },
        ],
        requestBody: imageBody,
      },
    },
    '/api/renders/{id}': {
      get: {
        ...operation(
          'getRender',
          'Read a render and advance its existing job',
          ['read'],
          ref('Render'),
        ),
        security: [{ bearerAuth: [] }, {}],
        parameters: [id],
      },
      patch: {
        ...operation(
          'setRenderVisibility',
          'Change public-gallery visibility',
          ['share'],
          ref('Render'),
        ),
        parameters: [id],
        requestBody: jsonBody(object({ isPublic: boolean })),
      },
    },
    '/api/renders/{id}/render': {
      post: {
        ...operation('buildRender', 'Start the paid 3D build', ['spend'], ref('Render')),
        parameters: [id],
        requestBody: {
          ...jsonBody(
            object(
              {
                maxCredits: {
                  ...integer,
                  maximum: Number.MAX_SAFE_INTEGER,
                  description:
                    'Optional per-call authorized ceiling, enforced atomically at debit.',
                },
              },
              [],
            ),
          ),
          required: false,
        },
      },
    },
    '/api/renders/{id}/sheet': {
      post: {
        ...operation('startRenderSheet', 'Start the paid angle sheet', ['spend'], ref('Render')),
        parameters: [id],
      },
    },
    '/api/renders/{id}/sheet/redraw': {
      post: {
        ...operation(
          'redrawRenderSheet',
          'Pay to redraw the angle sheet',
          ['spend'],
          ref('Render'),
        ),
        parameters: [id],
        requestBody: jsonBody(object({ note: { type: 'string', minLength: 1, maxLength: 500 } })),
      },
    },
    '/api/renders/{id}/model': {
      get: {
        ...asset(
          'downloadModel',
          'Download the ready textured GLB; no USDZ conversion endpoint',
          'model/gltf-binary',
          true,
        ),
        parameters: [id, query('download', { type: 'string', enum: ['1'] })],
      },
    },
    '/api/renders/{id}/source': {
      get: asset(
        'getRenderSource',
        'Download the source photo; shared render visibility also exposes this asset',
        'image/*',
        true,
      ),
    },
    '/api/renders/{id}/preview': {
      get: asset(
        'getRenderPreview',
        'Download the angle sheet preview (or fallback source); watermarked until paid',
        'image/*',
        true,
      ),
    },
    '/api/renders/{id}/qr': {
      get: asset('getRenderQr', 'Download a QR code for the result page', 'image/svg+xml', true),
    },
    '/api/renders/{id}/materials': {
      get: {
        ...operation(
          'getRenderMaterials',
          'Read model material definitions and saved edits',
          ['read'],
          ref('Materials'),
        ),
        security: [{ bearerAuth: [] }, {}],
        parameters: [id],
      },
      put: {
        ...operation(
          'setRenderMaterials',
          'Replace material edits; an empty list resets the generated look',
          ['write'],
          ref('Materials'),
        ),
        parameters: [id],
        requestBody: jsonBody(object({ edits: array(ref('MaterialEdit')) })),
      },
    },
    '/api/renders/{id}/exports': {
      post: {
        ...operation(
          'exportRenderModel',
          'Convert the owned model to OBJ, FBX or BLEND and return a ten-minute download link',
          ['read'],
          ref('ModelExport'),
        ),
        parameters: [id],
        requestBody: jsonBody(
          object({ format: { type: 'string', enum: ['obj', 'fbx', 'blend'] } }),
        ),
      },
    },
    '/api/product-views': {
      get: operation(
        'listProductViews',
        'List recent owned product-view sets',
        ['read'],
        object({ sets: array(ref('ViewSet')), balance: integer }),
      ),
      post: {
        ...operation(
          'createProductViews',
          'Create a paid product-view set',
          ['spend'],
          ref('ViewSet'),
          201,
        ),
        requestBody: imageBody,
      },
    },
    '/api/product-views/{id}': {
      get: {
        ...operation(
          'getProductViews',
          'Read a product-view set and advance its existing job',
          ['read'],
          ref('ViewSet'),
        ),
        parameters: [id],
      },
    },
    '/api/product-views/{id}/render': {
      post: {
        ...operation(
          'createRenderFromViews',
          'Create or reuse a render draft from finished views; does not start a paid build',
          ['write'],
          object({ renderId: string }),
        ),
        parameters: [id],
      },
    },
    '/api/product-views/{id}/views/{view}': {
      get: {
        ...asset('getProductViewImage', 'Download a generated product view', 'image/jpeg'),
        parameters: [id, view],
      },
    },
    '/api/product-views/{id}/views/{view}/polish': {
      post: {
        ...operation(
          'polishProductView',
          'Pay to polish one product view',
          ['spend'],
          ref('ViewSet'),
        ),
        parameters: [id, view],
        requestBody: jsonBody(object({ note: { type: 'string', minLength: 1, maxLength: 500 } })),
      },
    },
    '/api/product-views/{id}/zip': {
      get: asset(
        'downloadProductViewsZip',
        'Download finished product views as a ZIP',
        'application/zip',
      ),
    },
    '/api/upscales': {
      get: {
        ...operation(
          'listUpscales',
          'List owned upscales filtered by render or view set',
          ['read'],
          object({ upscales: array(ref('Upscale')) }),
        ),
        parameters: [query('renderId', string), query('viewSetId', string)],
      },
      post: {
        ...operation(
          'createUpscale',
          'Start an upscale; reuse an existing upscale of the same picture',
          ['spend'],
          ref('Upscale'),
          202,
        ),
        requestBody: jsonBody(ref('CreateUpscale')),
      },
    },
    '/api/upscales/{id}': {
      get: {
        ...operation(
          'getUpscale',
          'Read an upscale and advance its existing job',
          ['read'],
          ref('Upscale'),
        ),
        parameters: [id],
      },
    },
    '/api/upscales/{id}/image': {
      get: asset('downloadUpscale', 'Download a completed upscale', 'image/jpeg'),
    },
    '/api/catalog/quote': {
      get: {
        ...operation(
          'quoteCatalog',
          'Quote a catalog batch before approving spend',
          ['read'],
          ref('CatalogQuote'),
        ),
        parameters: [query('items', { type: 'integer', minimum: 1, maximum: 100000 }, true)],
      },
    },
    '/api/catalog': {
      get: {
        ...operation(
          'getCatalog',
          'Read store products and advance the already authorized queue',
          ['read'],
          ref('CatalogPage'),
        ),
        parameters: storeQuery,
      },
      post: {
        ...operation(
          'submitCatalog',
          'Approve and queue store products; resulting model links are shared for embeds',
          ['write', 'spend', 'share'],
          object({ queued: integer, skipped: integer, quote: ref('CatalogQuote') }),
          202,
        ),
        requestBody: jsonBody(ref('CatalogSubmission')),
      },
      delete: {
        operationId: 'removeCatalog',
        summary: 'Forget store products; existing renders are retained',
        'x-required-scopes': ['write'],
        parameters: storeQuery,
        responses: { ...errors, 204: { description: 'Removed' } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description:
          'Keep keys server-side. OAuth and manual keys support read/write/spend/share scopes, expiry and a lifetime gross-debit credit cap. Revocation is effective on the next authentication.',
      },
    },
    schemas: {
      Error: object({ error: string, code: string, request_id: string, retryable: boolean }),
      Upload: object({
        id: string,
        contentType: imageType,
        size: { type: 'integer', minimum: 1, maximum: 4194304 },
        expiresAt: date,
      }),
      CreateRenderMultipart: imageSource,
      CreateRenderJson: {
        ...object(
          { upload_id: { type: 'string', minLength: 1 }, image_url: urlSource, ...metadata },
          [],
        ),
        oneOf: exclusiveSources(['upload_id', 'image_url']),
      },
      RenderPageQuery: object(
        {
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          cursor: string,
          status: renderStatus,
        },
        [],
      ),
      Render: object({
        id: string,
        status: renderStatus,
        prompt: nullableString,
        name: nullableString,
        error: nullableString,
        hasPreview: boolean,
        hasSheet: boolean,
        sheetNote: nullableString,
        hasModel: boolean,
        modelVersion: integer,
        credits: integer,
        renderCredits: integer,
        sheetCredits: integer,
        upscaleCredits: integer,
        canUpscale: boolean,
        isPublic: boolean,
        source: { type: 'string', enum: ['web', 'api', 'mcp'] },
        createdAt: date,
      }),
      RenderPage: object({
        renders: array(ref('Render')),
        balance: integer,
        nextCursor: nullableString,
      }),
      CreditQuote: object({
        pricing_variant: string,
        currency: { type: 'string', enum: ['usd', 'eur'] },
        balance: integer,
        render_credits: integer,
        sheet_credits: integer,
        product_views_credits: integer,
        view_polish_credits: integer,
        upscale_credits: integer,
        build_from_views_credits: integer,
        plans: {
          type: 'object',
          description:
            'Live pay-as-you-go and subscription prices in currency; never assume an advertised rate applies to this account.',
        },
        topup: object({
          plan: nullableString,
          currency: string,
          price_cents: integer,
          credits_per_unit: integer,
        }),
        buy: { type: 'string', format: 'uri' },
      }),
      MaterialEdit: object(
        {
          index: integer,
          baseColor: {
            type: 'array',
            items: { type: 'number', minimum: 0, maximum: 1 },
            minItems: 3,
            maxItems: 3,
          },
          roughness: { type: 'number', minimum: 0, maximum: 1 },
          metalness: { type: 'number', minimum: 0, maximum: 1 },
        },
        ['index'],
      ),
      Materials: object({
        materials: array(
          object({
            index: integer,
            name: nullableString,
            baseColor: {
              type: 'array',
              items: { type: 'number', minimum: 0, maximum: 1 },
              minItems: 3,
              maxItems: 3,
            },
            roughness: { type: 'number', minimum: 0, maximum: 1 },
            metalness: { type: 'number', minimum: 0, maximum: 1 },
          }),
        ),
        edits: array(ref('MaterialEdit')),
        version: integer,
      }),
      ModelExport: object({
        format: { type: 'string', enum: ['obj', 'fbx', 'blend'] },
        url: string,
        filename: string,
        expiresAt: string,
      }),
      ViewSet: object({
        id: string,
        name: nullableString,
        prompt: nullableString,
        status: { type: 'string', enum: ['drafting', 'processing', 'ready', 'failed'] },
        error: nullableString,
        views: array(
          object({
            view: string,
            status: { type: 'string', enum: ['drawing', 'upscaling', 'ready'] },
            hasImage: boolean,
            version: integer,
            isFlagged: boolean,
            problems: array(string),
            isPolishing: boolean,
            note: nullableString,
          }),
        ),
        readyCount: integer,
        viewCount: integer,
        credits: integer,
        polishCredits: integer,
        upscaleCredits: integer,
        buildCredits: integer,
        renderId: nullableString,
        createdAt: date,
      }),
      CreateUpscale: {
        oneOf: [
          object({ kind: { const: 'sheet' }, renderId: string }),
          object({ kind: { const: 'view' }, viewSetId: string, view: string }),
        ],
      },
      Upscale: object({
        id: string,
        kind: { type: 'string', enum: ['sheet', 'view'] },
        renderId: nullableString,
        viewSetId: nullableString,
        view: nullableString,
        status: { type: 'string', enum: ['processing', 'ready', 'failed'] },
        hasImage: boolean,
        width: { type: ['integer', 'null'] },
        height: { type: ['integer', 'null'] },
        credits: integer,
        createdAt: date,
      }),
      CatalogPlatform: { type: 'string', enum: ['shopify', 'woocommerce', 'prestashop', 'other'] },
      CatalogQuote: object({
        items: integer,
        creditsPerModel: integer,
        totalCredits: integer,
        balance: integer,
        missingCredits: integer,
      }),
      CatalogSubmission: object({
        platform: ref('CatalogPlatform'),
        store: { type: 'string', minLength: 1, maxLength: 255 },
        maxCredits: integer,
        items: {
          type: 'array',
          minItems: 1,
          maxItems: 100,
          items: object(
            {
              externalId: { type: 'string', minLength: 1, maxLength: 128 },
              title: { type: 'string', minLength: 1, maxLength: 120 },
              imageUrl: { type: 'string', format: 'uri', pattern: '^https://', maxLength: 2048 },
              note: { type: 'string', maxLength: 500 },
            },
            ['externalId', 'title', 'imageUrl'],
          ),
        },
      }),
      CatalogPage: object({
        items: array(
          object({
            externalId: string,
            title: string,
            state: {
              type: 'string',
              enum: [
                'queued',
                'drafting',
                'building',
                'ready',
                'needs_credits',
                'needs_info',
                'failed',
              ],
            },
            error: nullableString,
            renderId: nullableString,
            arUrl: nullableString,
            qrUrl: nullableString,
            modelUrl: nullableString,
          }),
        ),
        summary: { type: 'object', additionalProperties: integer },
        balance: integer,
      }),
    },
  },
};
