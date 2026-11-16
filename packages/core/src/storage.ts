import { randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { awsCredentialsProvider } from '@vercel/oidc-aws-credentials-provider';

const LOCAL_PREFIX = 'local:';
const S3_PREFIX = 'renders';

const localRoot = () =>
  resolve(
    /* turbopackIgnore: true */ process.env.DATA_DIR ??
      join(/* turbopackIgnore: true */ process.cwd(), '.data'),
  );

const withSuffix = (pathname: string) => {
  const dot = pathname.lastIndexOf('.');
  const suffix = randomBytes(6).toString('hex');
  return dot === -1
    ? `${pathname}-${suffix}`
    : `${pathname.slice(0, dot)}-${suffix}${pathname.slice(dot)}`;
};

let s3: S3Client | undefined;

// On Vercel, AWS_ROLE_ARN makes the client exchange the deployment's OIDC token for
// short-lived role credentials, so no static AWS keys live in the project.
const s3Client = () => {
  s3 ??= new S3Client({
    region: process.env.AWS_REGION,
    ...(process.env.AWS_ROLE_ARN
      ? { credentials: awsCredentialsProvider({ roleArn: process.env.AWS_ROLE_ARN }) }
      : {}),
  });
  return s3;
};

/** Stores bytes and returns the key getFile reads back: a CDN URL, or a local key in dev. */
export async function putFile(
  pathname: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  const bucket = process.env.S3_BUCKET;
  // Everything lives under renders/ in the bucket, so https://cdn.easyrender.ai/renders/... is the public URL.
  const key = withSuffix(bucket ? `${S3_PREFIX}/${pathname}` : pathname);
  if (bucket) {
    const cdn = process.env.ASSETS_CDN_URL;
    if (!cdn) throw new Error('ASSETS_CDN_URL is not set: it must point at the bucket CDN');
    await s3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType,
        CacheControl: pathname.startsWith('uploads/')
          ? 'private, no-store, max-age=0'
          : 'public, max-age=31536000, immutable',
      }),
    );
    return `${cdn.replace(/\/+$/, '')}/${key}`;
  }
  if (process.env.VERCEL) {
    throw new Error('S3_BUCKET is not set: configure S3 storage for this deployment');
  }
  const target = join(localRoot(), key);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return `${LOCAL_PREFIX}${key}`;
}

export async function getFile(key: string): Promise<Uint8Array> {
  return new Uint8Array(await new Response(await getFileStream(key)).arrayBuffer());
}

/** Pass through unchanged model assets without retaining a second full GLB in server memory. */
export async function getFileStream(key: string): Promise<ReadableStream<Uint8Array>> {
  if (key.startsWith(LOCAL_PREFIX)) {
    const target = resolve(localRoot(), key.slice(LOCAL_PREFIX.length));
    if (!target.startsWith(localRoot() + sep)) throw new Error('invalid storage key');
    await stat(/* turbopackIgnore: true */ target);
    return Readable.toWeb(
      createReadStream(/* turbopackIgnore: true */ target),
    ) as ReadableStream<Uint8Array>;
  }
  const response = await fetch(key, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok || !response.body) throw new Error(`storage read failed: ${response.status}`);
  return response.body;
}

/** Cleanup is deliberately limited to our temporary upload namespace. */
export async function deleteUploadFile(key: string): Promise<void> {
  const isUpload = (path: string) => /^uploads\/[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/.test(path);
  if (key.startsWith(LOCAL_PREFIX)) {
    const path = key.slice(LOCAL_PREFIX.length);
    if (!isUpload(path)) throw new Error('invalid temporary upload key');
    await rm(join(localRoot(), path), { force: true });
    return;
  }
  const base = process.env.ASSETS_CDN_URL?.replace(/\/+$/, '');
  const prefix = base ? `${base}/${S3_PREFIX}/` : null;
  const path = prefix && key.startsWith(prefix) ? key.slice(prefix.length) : null;
  if (!process.env.S3_BUCKET || !path || !isUpload(path))
    throw new Error('invalid temporary upload key');
  await s3Client().send(
    new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: `${S3_PREFIX}/${path}` }),
    { abortSignal: AbortSignal.timeout(10_000) },
  );
}
