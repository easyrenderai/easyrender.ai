import { randomUUID } from 'node:crypto';
import { db } from '@easyrender/db';
import { afterAll, describe, expect, it } from 'vitest';
import { consumeApiRateLimit } from './api-limits';

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

describe.skipIf(!url)('shared API request limits', () => {
  afterAll(async () => {
    await db().$disconnect();
  });
  it('allows only the configured count under concurrent requests', async () => {
    const subject = `audit:${randomUUID()}`;
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => consumeApiRateLimit(subject, 4, 3600)),
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(4);
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(rejected).toHaveLength(16);
    for (const result of rejected) {
      if (result.status === 'rejected')
        expect(result.reason).toMatchObject({
          status: 429,
          code: 'rate_limit',
          retryAfter: expect.any(Number),
        });
    }
  });
});
