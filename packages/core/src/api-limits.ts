import { createHash } from 'node:crypto';
import { db } from '@easyrender/db';
import { AppError } from './errors';

export class ApiRateLimitError extends AppError {
  constructor(public readonly retryAfter: number) {
    super('Request limit reached. Retry after the indicated delay.', 429, 'rate_limit');
  }
}

// PostgreSQL upsert is shared across instances; concurrent requests cannot each spend the last slot.
export async function consumeApiRateLimit(subject: string, limit: number, windowSeconds = 60) {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const start = Math.floor(now / windowMs) * windowMs;
  const expiresAt = new Date(start + windowMs);
  const id = createHash('sha256').update(`${subject}:${start}`).digest('hex');
  const row = await db().apiRateWindow.upsert({
    where: { id },
    create: { id, expiresAt },
    update: { count: { increment: 1 } },
  });
  if (row.count > limit)
    throw new ApiRateLimitError(Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000)));
}

export async function cleanApiRateWindows() {
  return db().apiRateWindow.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
