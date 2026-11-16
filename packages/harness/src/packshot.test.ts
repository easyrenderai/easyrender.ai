import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { LIMITS } from './guardrails';
import {
  betterView,
  checkView,
  composeSheet,
  finishView,
  isViewId,
  measureObject,
  needsUpscale,
  PACKSHOT_SIDE,
  viewPrompt,
  viewRequest,
} from './packshot';
import {
  BUILD_FROM_VIEWS_CREDITS,
  creditsFor,
  FINAL_SHEET_CREDITS,
  PRODUCT_VIEW_COUNT,
  PRODUCT_VIEWS_COST_USD,
  PRODUCT_VIEWS_CREDITS,
  RENDER_CREDITS,
  VIEW_POLISH_CREDITS,
  VIEW_REDRAW_COST_USD,
} from './pricing';
import { cutCells, VIEWS } from './sheet';

type Rgb = [number, number, number];

// A textured square (stripes, so it has edges to measure) on a backdrop, as a PNG.
async function picture(
  options: {
    size?: number;
    backdrop?: Rgb;
    colour?: Rgb;
    box?: { left: number; top: number; width: number; height: number };
    blur?: number;
  } = {},
): Promise<Uint8Array> {
  const size = options.size ?? 800;
  const [br, bg, bb] = options.backdrop ?? [255, 255, 255];
  const [r, g, b] = options.colour ?? [180, 90, 40];
  const box = options.box ?? { left: 200, top: 200, width: 400, height: 400 };
  const data = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inside =
        x >= box.left && x < box.left + box.width && y >= box.top && y < box.top + box.height;
      const stripe = inside && Math.floor(x / 10) % 2 === 0 ? 0.6 : 1;
      const i = (y * size + x) * 3;
      data[i] = inside ? r * stripe : br;
      data[i + 1] = inside ? g * stripe : bg;
      data[i + 2] = inside ? b * stripe : bb;
    }
  }
  let image = sharp(data, { raw: { width: size, height: size, channels: 3 } });
  if (options.blur) image = image.blur(options.blur);
  return new Uint8Array(await image.png().toBuffer());
}

describe('checkView', () => {
  it('passes a centred object on white that matches the photo', async () => {
    const source = await measureObject(await picture());
    const check = await checkView(await picture(), source);
    expect(check.problems).toEqual([]);
    expect(check.ok).toBe(true);
    expect(check.measures.objectSide).toBeGreaterThan(380);
    expect(check.measures.colourDrift).toBeLessThan(0.01);
  });

  it('flags a grey backdrop', async () => {
    const check = await checkView(await picture({ backdrop: [170, 170, 170] }), null);
    expect(check.problems).toContain('background');
  });

  it('flags an object that runs off the frame', async () => {
    const check = await checkView(
      await picture({ box: { left: 0, top: 150, width: 500, height: 500 } }),
      null,
    );
    expect(check.problems).toContain('cropped');
  });

  it('flags an empty picture and an object that is too small to use', async () => {
    expect(
      (await checkView(await picture({ box: { left: 0, top: 0, width: 0, height: 0 } }), null))
        .problems,
    ).toContain('empty');
    const small = await checkView(
      await picture({ box: { left: 350, top: 350, width: 110, height: 110 } }),
      null,
    );
    expect(small.problems).toContain('small');
  });

  it('flags a soft picture, and measures a sharp one as sharper', async () => {
    const sharpView = await checkView(await picture(), null);
    const soft = await checkView(await picture({ blur: 12 }), null);
    expect(soft.problems).toContain('blurry');
    expect(soft.measures.sharpness).toBeLessThan(sharpView.measures.sharpness);
  });

  it('flags a colour that is not the photo', async () => {
    const source = await measureObject(await picture({ colour: [200, 40, 40] }));
    const check = await checkView(await picture({ colour: [40, 60, 200] }), source);
    expect(check.problems).toContain('colour');
  });

  it('skips the colour check when the limits allow any drift', async () => {
    const source = await measureObject(await picture({ colour: [200, 40, 40] }));
    const check = await checkView(await picture({ colour: [40, 60, 200] }), source, {
      ...LIMITS,
      viewMaxColourDrift: 1,
    });
    expect(check.problems).not.toContain('colour');
  });
});

describe('finishView', () => {
  it('sets the object centred on a pure white canvas, from a slightly grey backdrop', async () => {
    const finished = await finishView(
      await picture({
        backdrop: [244, 244, 244],
        box: { left: 100, top: 300, width: 300, height: 200 },
      }),
    );
    const meta = await sharp(finished).metadata();
    expect(meta.format).toBe('jpeg');
    expect([meta.width, meta.height]).toEqual([PACKSHOT_SIDE, PACKSHOT_SIDE]);

    const stats = await measureObject(finished);
    // The backdrop is white, the object sits in the middle with an even margin.
    expect(stats.backdrop).toEqual([255, 255, 255]);
    expect(stats.borderWhite).toBe(1);
    const box = stats.box as NonNullable<typeof stats.box>;
    expect((box.left + box.right) / 2).toBeCloseTo(0.5, 1);
    expect((box.top + box.bottom) / 2).toBeCloseTo(0.5, 1);
    expect(box.right - box.left).toBeGreaterThan(0.8);
  });

  it('gives a finished view that passes its own checks', async () => {
    const finished = await finishView(await picture({ backdrop: [246, 246, 246] }));
    expect((await checkView(finished, null)).problems).toEqual([]);
  });
});

describe('composeSheet', () => {
  it('lays nine views back into a sheet that cuts into nine cells', async () => {
    const views = await Promise.all(VIEWS.map(() => picture({ size: 400 })));
    const sheet = await composeSheet(views);
    expect((await sharp(sheet).metadata()).width).toBe(682 * 3);
    expect(await cutCells(sheet)).toHaveLength(9);
  });

  it('needs all nine views', async () => {
    await expect(composeSheet([await picture({ size: 400 })])).rejects.toThrow('expected 9 views');
  });
});

describe('view prompts and requests', () => {
  it('names the view and carries the owner note and what the checks found', () => {
    const prompt = viewPrompt({
      view: 'back_left',
      note: 'the handle is on the wrong side',
      problems: ['background', 'colour'],
      hasDraft: true,
    });
    expect(prompt).toContain('back-left three-quarter view');
    expect(prompt).toContain('Image 2 is a draft');
    expect(prompt).toContain('Fix this in the view: the handle is on the wrong side');
    expect(prompt).toContain('pure white');
    expect(prompt).toContain('exact colours');
  });

  it('sends the photo, plus the draft when there is one', () => {
    expect(viewRequest('https://p/photo', null, 'x').body.input.image_input).toEqual([
      'https://p/photo',
    ]);
    expect(viewRequest('https://p/photo', 'https://p/draft', 'x').body.input.image_input).toEqual([
      'https://p/photo',
      'https://p/draft',
    ]);
  });

  it('upscales only a view that is short of the canvas', () => {
    expect(needsUpscale(2400)).toBe(false);
    expect(needsUpscale(PACKSHOT_SIDE)).toBe(false);
    expect(needsUpscale(1999)).toBe(true);
    expect(needsUpscale(660)).toBe(true);
  });

  it('knows the nine view ids', () => {
    expect(VIEWS.every(isViewId)).toBe(true);
    expect(isViewId('bottom')).toBe(false);
  });
});

describe('betterView', () => {
  it('prefers fewer problems, then the sharper picture', () => {
    expect(
      betterView({ problems: [], sharpness: 1 }, { problems: ['colour'], sharpness: 99 }),
    ).toBe('a');
    expect(betterView({ problems: ['colour'], sharpness: 5 }, { problems: [], sharpness: 1 })).toBe(
      'b',
    );
    expect(betterView({ problems: [], sharpness: 5 }, { problems: [], sharpness: 9 })).toBe('b');
  });
});

describe('product views pricing', () => {
  it('prices the set and a polish at provider cost plus the margin', () => {
    expect(PRODUCT_VIEW_COUNT).toBe(VIEWS.length);
    expect(PRODUCT_VIEWS_CREDITS).toBe(creditsFor(PRODUCT_VIEWS_COST_USD));
    expect(VIEW_POLISH_CREDITS).toBe(creditsFor(VIEW_REDRAW_COST_USD));
    // At least 70% of what a credit sells for is margin.
    expect(PRODUCT_VIEWS_CREDITS * 0.01 * 0.3).toBeGreaterThanOrEqual(
      PRODUCT_VIEWS_COST_USD - 1e-9,
    );
    expect(VIEW_POLISH_CREDITS * 0.01 * 0.3).toBeGreaterThanOrEqual(VIEW_REDRAW_COST_USD - 1e-9);
  });

  it('charges a 3D build from a finished set for the 3D step only', () => {
    expect(FINAL_SHEET_CREDITS + BUILD_FROM_VIEWS_CREDITS).toBe(RENDER_CREDITS);
    expect(BUILD_FROM_VIEWS_CREDITS).toBeGreaterThan(0);
  });
});
