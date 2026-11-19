import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { LIMITS } from './guardrails';
import { inconsistentOppositeViews } from './sheet-structure';

async function silhouette(isClosed: boolean, colour = '#57432b', width = 200) {
  return sharp(
    Buffer.from(
      `<svg width="300" height="300" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="300" fill="white"/><path fill="${colour}" d="M40 70h${width}v${isClosed ? 150 : 25}H40z M40 70h25v150H40z M${40 + width - 25} 70h25v150h-25z"/></svg>`,
    ),
  )
    .png()
    .toBuffer();
}

describe('opposite-view openings', () => {
  it.each([false, true])(
    'preserves a consistently open or closed object (%s)',
    async (isClosed) => {
      const cell = await silhouette(isClosed);
      expect(
        await inconsistentOppositeViews(
          Array.from({ length: 9 }, () => cell),
          LIMITS,
        ),
      ).toEqual([]);
    },
  );

  it('detects a closed opening in either front/back direction', async () => {
    const open = await silhouette(false),
      closed = await silhouette(true);
    for (const [front, back] of [
      [open, closed],
      [closed, open],
    ] as const) {
      const cells = Array.from({ length: 9 }, () => open);
      cells[0] = front;
      cells[4] = back;
      expect(await inconsistentOppositeViews(cells, LIMITS)).toEqual(['front_back']);
    }
  });

  it('leaves pale or differently framed silhouettes inconclusive', async () => {
    const open = await silhouette(false);
    const pale = await silhouette(true, '#eeeeee');
    const narrow = await silhouette(true, '#57432b', 80);
    for (const back of [pale, narrow]) {
      const cells = Array.from({ length: 9 }, () => open);
      cells[4] = back;
      expect(await inconsistentOppositeViews(cells, LIMITS)).toEqual([]);
    }
  });
});
