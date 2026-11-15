import {
  type ApiKeyOptions,
  AppError,
  createApiKey,
  isApiKeyScope,
  listApiKeys,
  revokeApiKey,
} from '@easyrender/core';
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

// Keys are managed from a browser session only, never with another key.
async function requireUser() {
  const user = await currentUser();
  if (!user) throw new AppError('Sign in first', 401, 'unauthorized');
  return user;
}

export const GET = (request: Request) =>
  apiHandle(request, async () => NextResponse.json(await listApiKeys((await requireUser()).id)));

export const POST = (request: Request) =>
  apiHandle(request, async () => {
    const user = await requireUser();
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object')
      throw new AppError('Send a JSON object', 400, 'bad_body');
    const options: ApiKeyOptions = {};
    if (body.scopes !== undefined) {
      if (!Array.isArray(body.scopes) || !body.scopes.every(isApiKeyScope))
        throw new AppError('Invalid scopes', 400, 'bad_key_options');
      options.scopes = body.scopes;
    }
    if (body.creditLimit !== undefined) {
      if (body.creditLimit !== null && typeof body.creditLimit !== 'number')
        throw new AppError('Invalid creditLimit', 400, 'bad_key_options');
      options.creditLimit = body.creditLimit;
    }
    if (body.expiresAt !== undefined) {
      if (body.expiresAt !== null && typeof body.expiresAt !== 'string')
        throw new AppError('Invalid expiresAt', 400, 'bad_key_options');
      options.expiresAt = body.expiresAt === null ? null : new Date(body.expiresAt);
    }
    return NextResponse.json(await createApiKey(user.id, String(body.name ?? 'API key'), options), {
      status: 201,
    });
  });

export const DELETE = (request: Request) =>
  apiHandle(request, async () => {
    const user = await requireUser();
    await revokeApiKey(user.id, new URL(request.url).searchParams.get('id') ?? '');
    return new Response(null, { status: 204 });
  });

export const OPTIONS = apiOptions;
