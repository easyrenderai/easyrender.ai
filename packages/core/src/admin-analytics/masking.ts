/** Mask before serializing admin data; malformed addresses never fall back to plaintext. */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '—';
  const parts = email.trim().split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1].includes('.')) return '***';
  const [local, domain] = parts;
  const labels = domain.split('.');
  if (labels.some((label) => !label)) return '***';
  // Always hide at least one character, including one-character mailboxes/domains.
  const prefix = local.slice(0, Math.min(2, Math.max(0, local.length - 1)));
  const host = labels.slice(0, -1).map((label) => `${label.length > 1 ? label[0] : ''}***`);
  return `${prefix}***@${host.join('.')}.${labels.at(-1)}`;
}
