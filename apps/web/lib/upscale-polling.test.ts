import { describe, expect, it } from 'vitest';
import { upscalePollInterval } from './upscale-polling';

describe('upscalePollInterval', () => {
  it('polls every 3 seconds while an enlargement is processing', () => {
    expect(upscalePollInterval([{ status: 'ready' }, { status: 'processing' }])).toBe(3000);
  });

  it('stops when every enlargement is done or failed', () => {
    expect(upscalePollInterval([{ status: 'ready' }, { status: 'failed' }])).toBe(false);
  });

  it('does not poll before the first load or with no rows', () => {
    expect(upscalePollInterval(undefined)).toBe(false);
    expect(upscalePollInterval([])).toBe(false);
  });
});
