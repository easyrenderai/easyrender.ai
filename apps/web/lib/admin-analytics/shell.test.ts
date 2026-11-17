import { afterEach, describe, expect, it, vi } from 'vitest';

const guard = vi.hoisted(() => ({ isAllowed: true }));
vi.mock('@/lib/admin-analytics/auth', () => ({
  requireAdmin: async () => {
    if (!guard.isAllowed) throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));

import AdminIndexPage from '@/app/(admin)/admin/page';
import { isActivePath, isAdminPath } from '@/components/app-shell/nav';

afterEach(() => {
  guard.isAllowed = true;
});

describe('admin routing', () => {
  it('sends /admin to the analytics overview for an admin', async () => {
    await expect(AdminIndexPage()).rejects.toThrow('REDIRECT:/admin/analytics');
  });

  it('keeps the guard in front of the redirect for everyone else', async () => {
    guard.isAllowed = false;
    await expect(AdminIndexPage()).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('recognises every admin page, and nothing that only starts with the word', () => {
    expect(isAdminPath('/admin')).toBe(true);
    expect(isAdminPath('/admin/analytics/revenue')).toBe(true);
    expect(isAdminPath('/administrators')).toBe(false);
    expect(isAdminPath('/dashboard')).toBe(false);
  });

  it('leaves every rail item inactive on an admin page', () => {
    for (const href of ['/dashboard', '/library', '/views', '/account']) {
      expect(isActivePath('/admin/analytics', href)).toBe(false);
    }
  });
});
