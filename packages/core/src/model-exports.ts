import { createSign } from 'node:crypto';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { db } from '@easyrender/db';
import { awsCredentialsProvider } from '@vercel/oidc-aws-credentials-provider';
import { consumeApiRateLimit } from './api-limits';
import { AppError, notFound } from './errors';
import { servedModel } from './render-materials';
import { type Actor, canAccess } from './renders';
import { getFile } from './storage';

// Download a finished render in another 3D format. The stored model is always the GLB; OBJ, FBX
// and BLEND are made on demand by the Blender converter (services/model-export, a Lambda function
// that runs once per export) and kept for a day in a private bucket. The owner gets a link that
// CloudFront only honours while its signature is valid, so the file is never public.

export const MODEL_EXPORT_FORMATS = ['obj', 'fbx', 'blend'] as const;
export type ModelExportFormat = (typeof MODEL_EXPORT_FORMATS)[number];

// What the converter writes for each format: OBJ needs its MTL and textures next to it.
const EXTENSION: Record<ModelExportFormat, string> = { obj: 'zip', fbx: 'fbx', blend: 'blend' };

const PREFIX = 'exports/';
const LINK_MINUTES = 10;
// S3 deletes a converted file one day after it was written. A file older than this is converted
// again rather than linked, so a link never points at something about to disappear.
const REUSE_HOURS = 12;
const EXPORTS_PER_HOUR = 30;
const DEFAULT_SIGNING_SECRET = 'easyrender/exports/signing-private-key';

export type ModelExport = {
  format: ModelExportFormat;
  url: string;
  filename: string;
  expiresAt: string;
};

type ConvertRequest = {
  sourceKey: string;
  format: ModelExportFormat;
  outputKey: string;
  downloadName: string;
};
type ConvertResult = { ok: true } | { ok: false; error: string };

/** The AWS calls an export makes. Tests pass their own. */
export type ModelExportGateway = {
  /** When the object was written, or null when it does not exist. */
  writtenAt(key: string): Promise<Date | null>;
  put(key: string, bytes: Uint8Array): Promise<void>;
  convert(request: ConvertRequest): Promise<ConvertResult>;
  /** PEM private key whose public half CloudFront trusts for /exports/*. */
  signingKey(): Promise<string>;
};

type ExportConfig = { bucket: string; cdnUrl: string; keyPairId: string; functionName: string };

function exportConfig(): ExportConfig | null {
  const bucket = process.env.EXPORTS_BUCKET;
  const cdnUrl = process.env.EXPORTS_CDN_URL?.replace(/\/+$/, '');
  const keyPairId = process.env.EXPORTS_KEY_PAIR_ID;
  const functionName = process.env.MODEL_EXPORT_FUNCTION;
  if (!bucket || !cdnUrl || !keyPairId || !functionName) return null;
  return { bucket, cdnUrl, keyPairId, functionName };
}

/** False until the deployment has the exports bucket, CDN path and converter configured. */
export const isModelExportEnabled = () => exportConfig() !== null;

export const isModelExportFormat = (value: unknown): value is ModelExportFormat =>
  typeof value === 'string' && (MODEL_EXPORT_FORMATS as readonly string[]).includes(value);

/**
 * A CloudFront signed URL (canned policy): the URL is valid until `expires` and for nothing else.
 * https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-creating-signed-url-canned-policy.html
 */
export function signExportUrl(url: string, keyPairId: string, privateKey: string, expires: Date) {
  const epoch = Math.floor(expires.getTime() / 1000);
  const policy = JSON.stringify({
    Statement: [{ Resource: url, Condition: { DateLessThan: { 'AWS:EpochTime': epoch } } }],
  });
  const signature = createSign('RSA-SHA1')
    .update(policy)
    .sign(privateKey, 'base64')
    .replace(/\+/g, '-')
    .replace(/=/g, '_')
    .replace(/\//g, '~');
  return `${url}?Expires=${epoch}&Signature=${signature}&Key-Pair-Id=${keyPairId}`;
}

/**
 * Converts the caller's own finished render to `format` and returns a short-lived download link.
 * Owner only, signed in. The export is the model as the owner sees it, material edits included.
 */
export async function createModelExport(
  id: string,
  actor: Actor,
  format: unknown,
  gateway?: ModelExportGateway,
  now = new Date(),
): Promise<ModelExport> {
  if (!isModelExportFormat(format)) {
    throw new AppError(
      `Send { "format": ${MODEL_EXPORT_FORMATS.map((f) => `"${f}"`).join(' | ')} }`,
      400,
      'bad_body',
    );
  }
  const render = await db().render.findUnique({ where: { id } });
  // The same answer for a render that does not exist and one that is someone else's.
  if (!render || !actor.userId || !canAccess(render, actor)) throw notFound();
  if (render.status !== 'ready' || !render.glbKey) {
    throw new AppError('Build the 3D model before exporting it', 409, 'not_ready');
  }
  const config = exportConfig();
  if (!config) {
    throw new AppError('Model exports are not available yet', 503, 'exports_unavailable');
  }
  await consumeApiRateLimit(`model-export:${actor.userId}`, EXPORTS_PER_HOUR, 3600);
  const aws = gateway ?? awsGateway(config);

  // updatedAt moves whenever the material edits do, so an edit is never served a stale export.
  const folder = `${PREFIX}${render.id}/${render.updatedAt.getTime()}`;
  const extension = EXTENSION[format];
  const outputKey = `${folder}/model-${format}.${extension}`;
  const filename = `easyrender-${render.id}-${format}.${extension}`;

  const written = await aws.writtenAt(outputKey);
  const isReusable = written && now.getTime() - written.getTime() < REUSE_HOURS * 3_600_000;
  if (!isReusable) {
    const sourceKey = `${folder}/source.glb`;
    await aws.put(sourceKey, servedModel(render, await getFile(render.glbKey)));
    const result = await aws.convert({
      sourceKey,
      format,
      outputKey,
      downloadName: `easyrender-${render.id}-${format}`,
    });
    if (!result.ok) {
      throw new AppError(`The model could not be converted: ${result.error}`, 422, 'export_failed');
    }
  }

  const expires = new Date(now.getTime() + LINK_MINUTES * 60_000);
  const url = `${config.cdnUrl}/${outputKey.slice(PREFIX.length)}`;
  return {
    format,
    url: signExportUrl(url, config.keyPairId, await aws.signingKey(), expires),
    filename,
    expiresAt: expires.toISOString(),
  };
}

let cachedKey: { pem: string; readAt: number } | undefined;

// On Vercel the clients trade the deployment's OIDC token for the storage stack's role, the same
// way storage.ts does. That role may write and read exports/*, start the converter and read the
// signing key, and nothing else here.
function awsGateway(config: ExportConfig): ModelExportGateway {
  const options = {
    region: process.env.AWS_REGION,
    ...(process.env.AWS_ROLE_ARN
      ? { credentials: awsCredentialsProvider({ roleArn: process.env.AWS_ROLE_ARN }) }
      : {}),
  };
  const s3 = new S3Client(options);
  const lambda = new LambdaClient(options);
  const secrets = new SecretsManagerClient(options);
  // The caller sees a retryable 503; the AWS error travels as the cause to error reporting.
  const upstream = (cause: unknown) =>
    Object.assign(
      new AppError('Model export is temporarily unavailable', 503, 'upstream_unavailable'),
      { cause },
    );
  return {
    async writtenAt(key) {
      try {
        const head = await s3.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }), {
          abortSignal: AbortSignal.timeout(10_000),
        });
        return head.LastModified ?? null;
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode;
        if (status === 404 || status === 403) return null;
        throw upstream(error);
      }
    },
    async put(key, bytes) {
      await s3
        .send(
          new PutObjectCommand({
            Bucket: config.bucket,
            Key: key,
            Body: bytes,
            ContentType: 'model/gltf-binary',
          }),
          { abortSignal: AbortSignal.timeout(30_000) },
        )
        .catch((error) => {
          throw upstream(error);
        });
    },
    async convert(request) {
      const response = await lambda
        .send(
          new InvokeCommand({
            FunctionName: config.functionName,
            Payload: new TextEncoder().encode(JSON.stringify(request)),
          }),
          { abortSignal: AbortSignal.timeout(110_000) },
        )
        .catch((error) => {
          throw upstream(error);
        });
      // A crash or a timeout inside the function: nothing was charged, the caller may retry.
      if (response.FunctionError || !response.Payload) throw upstream(new Error('converter'));
      const body = JSON.parse(new TextDecoder().decode(response.Payload)) as {
        ok?: boolean;
        error?: string;
      };
      return body.ok
        ? { ok: true }
        : { ok: false, error: body.error ?? 'the converter gave no reason' };
    },
    async signingKey() {
      // Read once per hour per instance, so a rotated key is picked up without a deploy.
      if (cachedKey && Date.now() - cachedKey.readAt < 3_600_000) return cachedKey.pem;
      const secret = await secrets
        .send(
          new GetSecretValueCommand({
            SecretId: process.env.EXPORTS_SIGNING_SECRET || DEFAULT_SIGNING_SECRET,
          }),
          { abortSignal: AbortSignal.timeout(10_000) },
        )
        .catch((error) => {
          throw upstream(error);
        });
      if (!secret.SecretString) throw upstream(new Error('signing key'));
      cachedKey = { pem: secret.SecretString, readAt: Date.now() };
      return cachedKey.pem;
    },
  };
}
