/** Keep OAuth return paths on admin pages, including the requested report filters. */
export function adminReturnPath(raw?: unknown): string {
  const fallback = '/admin/analytics';
  if (
    typeof raw !== 'string' ||
    !raw ||
    raw.length > 2048 ||
    [...raw].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 || char === '\\')
  )
    return fallback;
  if (raw !== '/admin' && !raw.startsWith('/admin/')) return fallback;
  try {
    const url = new URL(raw, 'https://easyrender.ai');
    if (
      url.origin !== 'https://easyrender.ai' ||
      url.pathname.includes('%') ||
      (url.pathname !== '/admin' && !url.pathname.startsWith('/admin/'))
    )
      return fallback;
    return url.pathname + url.search;
  } catch {
    return fallback;
  }
}

export function adminVerificationPath(raw?: unknown): string {
  return `/sign-in/admin?next=${encodeURIComponent(adminReturnPath(raw))}`;
}
