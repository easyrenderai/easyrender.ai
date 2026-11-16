import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { buildCostUsd, buildRequest, FINAL_SHEET_MODEL, SHEET_MODEL } from './models';
import {
  CREDIT_USD,
  creditsFor,
  FINAL_SHEET_COST_USD,
  isPlanId,
  isValidPaygCredits,
  PLAN_IDS,
  PRO_PLAN,
  paygPriceCents,
  RENDER_COST_USD,
  RENDER_CREDITS,
  rendersFor,
  SHEET_COST_USD,
  SHEET_CREDITS,
  SUBSCRIPTION_PLANS,
} from './pricing';
import { findGlbUrl } from './replicate';
import { cutCells, sheetOutputUrl, sheetPrompt, VIEWS } from './sheet';
import { watermark } from './watermark';

describe('pricing', () => {
  it('keeps a 70% margin over cost', () => {
    expect(creditsFor(0.3)).toBe(100);
    expect(creditsFor(0.24)).toBe(80);
    expect(RENDER_CREDITS).toBe(64);
    // revenue per render covers cost / (1 - margin)
    expect(RENDER_CREDITS * 0.01 * 0.3).toBeGreaterThanOrEqual(RENDER_COST_USD - 1e-9);
  });

  it('prices the angle sheet alone below the full render', () => {
    expect(SHEET_COST_USD).toBe(SHEET_MODEL.costUsd);
    expect(FINAL_SHEET_COST_USD).toBe(FINAL_SHEET_MODEL.costUsd);
    expect(SHEET_CREDITS).toBe(12);
    expect(SHEET_CREDITS).toBeLessThan(RENDER_CREDITS);
  });

  it('prices pay as you go at one cent per credit', () => {
    expect(paygPriceCents(1000)).toBe(1000);
    expect(paygPriceCents(2500)).toBe(2500);
    expect(isValidPaygCredits(499)).toBe(false);
    expect(isValidPaygCredits(500)).toBe(true);
    expect(isValidPaygCredits(100_000)).toBe(true);
    expect(isValidPaygCredits(100_001)).toBe(false);
    expect(isValidPaygCredits(1000.5)).toBe(false);
  });

  it('counts whole renders per credit amount', () => {
    expect(rendersFor(1000)).toBe(15);
    expect(rendersFor(PRO_PLAN.monthlyCredits)).toBe(85);
  });

  it('gives every monthly plan a cheaper credit than pay as you go, and a bigger plan a cheaper one', () => {
    expect(PLAN_IDS).toEqual(['creator', 'pro', 'scale']);
    const perCredit = PLAN_IDS.map(
      (id) => SUBSCRIPTION_PLANS[id].priceCents / 100 / SUBSCRIPTION_PLANS[id].monthlyCredits,
    );
    for (const price of perCredit) expect(price).toBeLessThan(CREDIT_USD);
    expect(perCredit).toEqual([...perCredit].sort((a, b) => b - a));
    expect(new Set(perCredit).size).toBe(perCredit.length);
  });

  it('only accepts known plan ids', () => {
    expect(['creator', 'pro', 'scale'].every(isPlanId)).toBe(true);
    expect(['enterprise', 'toString', '', null, 3].some(isPlanId)).toBe(false);
  });
});

describe('replicate output', () => {
  it('finds the GLB in nested TRELLIS output', () => {
    expect(findGlbUrl({ model_file: 'https://x/a.glb', color_video: 'https://x/v.mp4' })).toBe(
      'https://x/a.glb',
    );
    expect(findGlbUrl(['https://x/v.mp4', { mesh: 'https://x/m.glb?sig=1' }])).toBe(
      'https://x/m.glb?sig=1',
    );
    expect(findGlbUrl({ video: 'https://x/v.mp4' })).toBeNull();
  });

  it('reads the sheet URL from string or array output', () => {
    expect(sheetOutputUrl('https://x/s.png')).toBe('https://x/s.png');
    expect(sheetOutputUrl(['https://x/s.png'])).toBe('https://x/s.png');
    expect(sheetOutputUrl(null)).toBeNull();
  });

  it('prices the build by GPU seconds and keeps the photo first', () => {
    expect(buildCostUsd(60)).toBeCloseTo(0.084);
    expect(buildRequest(['p', 'c1']).input.images).toEqual(['p', 'c1']);
  });
});

describe('sheet', () => {
  it('appends the user note without replacing the turnaround prompt', () => {
    expect(sheetPrompt('')).not.toContain('Additional notes');
    const prompt = sheetPrompt('  teak outdoor bench ');
    expect(prompt).toContain('3x3 turnaround sheet');
    expect(prompt.endsWith('Additional notes about the object: teak outdoor bench')).toBe(true);
  });

  it('cuts nine inset cells from a square sheet', async () => {
    const sheet = await sharp({
      create: { width: 300, height: 300, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer();
    const cells = await cutCells(new Uint8Array(sheet));
    expect(cells).toHaveLength(VIEWS.length);
    const meta = await sharp(cells[0]).metadata();
    expect([meta.width, meta.height]).toEqual([84, 84]);
  });

  it('watermarks a downscaled preview', async () => {
    const sheet = await sharp({
      create: { width: 2048, height: 2048, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer();
    const preview = await watermark(new Uint8Array(sheet));
    const meta = await sharp(preview).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(1024);
  });

  it('draws the brand mark over the preview, as shapes that need no fonts', async () => {
    const sheet = await sharp({
      create: { width: 1024, height: 1024, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer();
    const preview = await sharp(await watermark(new Uint8Array(sheet)))
      .raw()
      .toBuffer({
        resolveWithObject: true,
      });
    // A plain white sheet has no darker pixels; the mark puts some on it.
    const dark = [...preview.data].filter((value, index) => index % 3 === 0 && value < 235).length;
    expect(dark).toBeGreaterThan(5000);
    // The marks are sparse, so most of the image is still the photo.
    expect(dark).toBeLessThan((1024 * 1024) / 4);
  });
});
