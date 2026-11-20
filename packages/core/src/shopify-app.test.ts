import { describe, expect, it } from 'vitest';
import { buildProductRows } from './shopify-app';

const product = (id: string, imageUrl: string | null, renderId: string | null = null) => ({
  id,
  gid: `gid://shopify/Product/${id}`,
  title: `Product ${id}`,
  imageUrl,
  renderId,
});

describe('buildProductRows', () => {
  it('labels each product by where it is and lets only buildable ones be ticked', () => {
    const rows = buildProductRows(
      [
        product('1', 'https://cdn.shopify.com/1.jpg?v=3'),
        product('2', 'https://cdn.shopify.com/2.jpg'),
        product('3', 'https://cdn.shopify.com/3.jpg', 'render-3'),
        product('4', null),
        product('5', 'https://cdn.shopify.com/5.jpg'),
        product('6', 'https://cdn.shopify.com/6.jpg'),
        product('7', 'https://cdn.shopify.com/7.jpg'),
      ],
      [
        { externalId: '2', renderId: 'render-2', state: 'building', error: null },
        { externalId: '5', renderId: null, state: 'failed', error: 'Generation failed.' },
        { externalId: '6', renderId: null, state: 'queued', error: null },
        { externalId: '7', renderId: 'render-7', state: 'ready', error: null },
      ],
      new Set(['1', '5']),
      new Map([['2', 'model' as const]]),
    );
    expect(rows.map((row) => [row.id, row.status, row.stage, row.isSelectable])).toEqual([
      ['1', 'missing', null, true],
      ['2', 'building', 'model', false],
      ['3', 'ready', null, false],
      ['4', 'no_photo', null, false],
      ['5', 'failed', null, true],
      ['6', 'queued', 'waiting', false],
      ['7', 'ready', null, false],
    ]);
    // Thumbnails are resized by Shopify's CDN; a failed product shows why.
    expect(rows[0]?.imageUrl).toBe('https://cdn.shopify.com/1.jpg?v=3&width=120');
    expect(rows[4]?.error).toBe('Generation failed.');
  });
});
