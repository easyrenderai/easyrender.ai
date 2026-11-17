import { expect, it } from 'vitest';
import { adminReturnPath, adminVerificationPath } from './navigation';

it('preserves the admin destination and its filters through verification', () => {
  const target = '/admin/analytics/revenue?period=90d&includeTeam=1';
  expect(adminReturnPath(target)).toBe(target);
  expect(
    new URL(adminVerificationPath(target), 'https://example.test').searchParams.get('next'),
  ).toBe(target);
});

it.each([
  undefined,
  ['/admin/analytics', '/admin/gift-credits'],
  '//evil.test',
  'https://evil.test/admin',
  '/admin/../../account',
  '/account',
  '/admin\\evil.test',
  '/admin/%2e%2e/account',
  '/admin/%2f%2fevil.test',
  '/admin/analytics\n',
])('rejects unsafe or non-admin destinations: %s', (target) => {
  expect(adminReturnPath(target)).toBe('/admin/analytics');
});
