import { describe, expect, it } from 'vitest';
import { currentSlot, DAY, hasCapacity, isSendingHour } from './policy';

const created = new Date('2026-11-01T10:00:00Z');
const at = (days: number) => new Date(+created + days * DAY);
describe('onboarding send policy', () => {
  it('selects only the current 24h slot, never catches up missed messages', () => {
    expect(currentSlot(created, at(0.5))).toBe(0);
    expect(currentSlot(created, at(1.5))).toBeNull();
    expect(currentSlot(created, at(10.2))).toBe(10);
    expect(currentSlot(created, at(17))).toBeNull();
    expect(currentSlot(created, at(28.9))).toBe(28);
  });
  it('ends at day30 and rejects future registrations', () => {
    expect(currentSlot(created, at(30))).toBeNull();
    expect(currentSlot(created, at(-1))).toBeNull();
  });
  it('shares rolling commercial caps instead of calendar days', () => {
    expect(hasCapacity([at(0)], at(0.9))).toBe(false);
    expect(hasCapacity([at(0)], at(1))).toBe(true);
    expect(hasCapacity([at(0), at(2), at(4)], at(6))).toBe(false);
    expect(hasCapacity([at(0), at(2), at(5), at(10), at(20), at(28)], at(29))).toBe(false);
  });
  it('respects recipient timezone and fails closed on invalid zones', () => {
    expect(isSendingHour('Europe/Madrid', new Date('2026-11-01T03:00:00Z'))).toBe(false);
    expect(isSendingHour('Europe/Madrid', created)).toBe(true);
    expect(isSendingHour('invalid', created)).toBe(false);
  });
});
it('sends result-dependent lessons only when a real owned result exists', async () => {
  const { isLessonEligible } = await import('./policy');
  expect(isLessonEligible('api_d10', { hasTask: true, hasResult: false })).toBe(false);
  expect(isLessonEligible('mcp_d05', { hasTask: true, hasResult: true })).toBe(true);
  expect(isLessonEligible('mcp_d10', { hasTask: false, hasResult: false })).toBe(false);
  expect(isLessonEligible('formats_d05', { hasTask: false, hasResult: false })).toBe(true);
});
