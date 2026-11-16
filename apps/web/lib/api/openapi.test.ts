import { readFileSync } from 'node:fs';
import { toUpscaleView, toView, toViewSetView } from '@easyrender/core';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv';
import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/openapi.json/route';
import { openapi } from './openapi';

const validator = new AjvJsonSchemaValidator();
function accepts(schema: string, value: unknown) {
  const document = {
    $ref: `#/components/schemas/${schema}`,
    components: openapi.components,
  };
  return validator.getValidator(document)(value).valid;
}

describe('public API contract', () => {
  it('serves a versioned, public machine-readable contract', async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual(openapi);
    expect(openapi.openapi).toBe('3.1.0');
    expect(openapi.info.version).toBe('1.0.0');
  });

  it('documents only implemented methods on the established resource routes', () => {
    for (const [path, methods] of Object.entries(openapi.paths)) {
      const route = path.replace(/\{([^}]+)\}/g, '[$1]');
      const source = readFileSync(new URL(`../../app${route}/route.ts`, import.meta.url), 'utf8');
      const implemented = [
        ...source.matchAll(
          /export (?:const|async function|function) (GET|POST|PATCH|PUT|DELETE)\b/g,
        ),
      ]
        .map((match) => match[1].toLowerCase())
        .sort();
      expect(Object.keys(methods).sort(), path).toEqual(implemented);
    }
  });

  it('resolves every local schema reference and has unique operation IDs', () => {
    const ids: string[] = [];
    function visit(value: unknown) {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        if (key === '$ref' && typeof child === 'string') {
          expect(child.startsWith('#/')).toBe(true);
          let resolved: unknown = openapi;
          for (const segment of child.slice(2).split('/')) {
            resolved = (resolved as Record<string, unknown>)[segment];
          }
          expect(resolved, child).toBeDefined();
        }
        if (key === 'operationId') ids.push(String(child));
        visit(child);
      }
    }
    visit(openapi);
    expect(ids.length).toBeGreaterThan(20);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('accepts the actual core render view and rejects missing status or wrong credit types', () => {
    // Only the fields consumed by the pure serializer are needed; no DB/provider activity.
    const view = toView({
      id: 'r_contract',
      status: 'preview_ready',
      prompt: null,
      name: 'Chair',
      credits: 0,
      sheetKey: null,
      sheetNote: null,
      glbKey: null,
      hasFinalSheet: false,
      isPublic: false,
      source: 'api',
      createdAt: new Date('2026-11-15T10:00:00Z'),
      updatedAt: new Date('2026-11-15T10:00:00Z'),
    } as Parameters<typeof toView>[0]);
    expect(accepts('Render', view)).toBe(true);
    expect(accepts('Render', { ...view, status: 'invented_state' })).toBe(false);
    expect(accepts('Render', { ...view, credits: 'free' })).toBe(false);
    const { status: _status, ...missingStatus } = view;
    expect(accepts('Render', missingStatus)).toBe(false);
  });

  it('validates real product-view and upscale serializers', () => {
    const set = toViewSetView({
      id: 'vs_contract',
      userId: 'u_contract',
      sourceKey: 'private/photo.jpg',
      sourceUrl: null,
      sheetKey: null,
      sheetPredictionId: null,
      sheetAttempts: 1,
      quality: null,
      costUsd: 0,
      error: null,
      updatedAt: new Date('2026-11-15T10:00:00Z'),
      name: null,
      prompt: null,
      status: 'drafting',
      views: [],
      credits: 0,
      renderId: null,
      createdAt: new Date('2026-11-15T10:00:00Z'),
    } as Parameters<typeof toViewSetView>[0]);
    expect(accepts('ViewSet', set)).toBe(true);
    expect(accepts('ViewSet', { ...set, status: 'drawing' })).toBe(false);
    const upscale = toUpscaleView({
      id: 'up_contract',
      kind: 'sheet',
      renderId: 'r_contract',
      viewSetId: null,
      view: null,
      status: 'processing',
      key: null,
      width: null,
      height: null,
      credits: 0,
      createdAt: new Date('2026-11-15T10:00:00Z'),
    } as Parameters<typeof toUpscaleView>[0]);
    expect(accepts('Upscale', upscale)).toBe(true);
    expect(accepts('Upscale', { ...upscale, status: 'rendering' })).toBe(false);
    expect(accepts('CreateUpscale', { kind: 'sheet', renderId: 'r_contract' })).toBe(true);
    expect(accepts('CreateUpscale', { kind: 'sheet', viewSetId: 'vs_contract' })).toBe(false);
  });

  it('requires exactly one source and bounds upload and pagination inputs', () => {
    expect(accepts('CreateRenderMultipart', { image: 'binary' })).toBe(true);
    expect(accepts('CreateRenderMultipart', { upload_id: 'u_123' })).toBe(true);
    expect(accepts('CreateRenderMultipart', { image: 'binary', upload_id: 'u_123' })).toBe(false);
    expect(accepts('CreateRenderMultipart', {})).toBe(false);
    expect(accepts('CreateRenderJson', { upload_id: 'u_123', isPublic: false })).toBe(true);
    expect(accepts('CreateRenderJson', { image_url: 'https://example.com/photo.jpg' })).toBe(true);
    expect(
      accepts('CreateRenderJson', {
        image_url: 'https://example.com/photo.jpg',
        upload_id: 'u_123',
      }),
    ).toBe(false);
    expect(accepts('CreateRenderJson', { upload_id: 'u_123', image: 'binary' })).toBe(false);
    expect(accepts('CreateRenderJson', { image_url: 'http://example.com/photo.jpg' })).toBe(false);
    expect(accepts('CreateRenderMultipart', { image_url: 'https://example.com/photo.jpg' })).toBe(
      true,
    );
    expect(
      accepts('CreateRenderMultipart', {
        image_url: 'https://example.com/photo.jpg',
        image: 'binary',
      }),
    ).toBe(false);
    const upload = {
      id: 'u_123',
      contentType: 'image/png',
      size: 4194304,
      expiresAt: '2026-11-15T11:00:00Z',
    };
    expect(accepts('Upload', upload)).toBe(true);
    expect(accepts('Upload', { ...upload, size: 4194305 })).toBe(false);
    expect(accepts('RenderPageQuery', { limit: 100, status: 'ready' })).toBe(true);
    expect(accepts('RenderPageQuery', { limit: 101 })).toBe(false);
    expect(accepts('RenderPageQuery', { limit: 0 })).toBe(false);
  });

  it('keeps paid and publication capabilities explicit', () => {
    expect(openapi.paths['/api/renders/{id}/render'].post['x-required-scopes']).toEqual(['spend']);
    expect(openapi.paths['/api/renders/{id}'].patch['x-required-scopes']).toEqual(['share']);
    expect(openapi.paths['/api/catalog'].post['x-required-scopes']).toEqual([
      'write',
      'spend',
      'share',
    ]);
    expect(
      accepts('Error', {
        error: 'Slow down',
        code: 'rate_limited',
        request_id: 'req_1',
        retryable: true,
      }),
    ).toBe(true);
    expect(accepts('Error', { error: 'Unknown' })).toBe(false);
  });
});
