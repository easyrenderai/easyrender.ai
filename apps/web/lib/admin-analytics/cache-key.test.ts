import { createHmac } from 'node:crypto';
import { expect, it } from 'vitest';
import { analyticsConfigKey } from './cache-key';

it('uses configuration as an HMAC key, with stable scoped cache identity', () => {
  const config = ['fixture-host', 'fixture-credential'];
  const key = analyticsConfigKey(config);
  expect(key).toBe(
    createHmac('sha256', JSON.stringify(config)).update('admin-analytics-config-v1').digest('hex'),
  );
  expect(key).toMatch(/^[a-f0-9]{64}$/);
  expect(key).not.toContain('fixture-credential');
  expect(analyticsConfigKey([...config, undefined])).not.toBe(key);
  expect(analyticsConfigKey(['fixture-host', 'rotated-fixture'])).not.toBe(key);
});
