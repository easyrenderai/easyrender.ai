export type SpendImportResult =
  | { imported: number }
  | {
      error:
        | 'spendImportTooLarge'
        | 'spendImportInvalid'
        | 'spendImportDenied'
        | 'spendImportFailed';
    };

export async function importSpendFile(
  file: File,
  fetcher: typeof fetch = fetch,
): Promise<SpendImportResult> {
  if (file.size > 512_000) return { error: 'spendImportTooLarge' };
  let body: string;
  try {
    body = await file.text();
    JSON.parse(body);
  } catch {
    return { error: 'spendImportInvalid' };
  }
  try {
    const response = await fetcher('/api/admin/analytics/ad-spend', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 401 || response.status === 403) return { error: 'spendImportDenied' };
    if (response.status === 413) return { error: 'spendImportTooLarge' };
    if (response.status === 400 || response.status === 415) return { error: 'spendImportInvalid' };
    if (!response.ok) return { error: 'spendImportFailed' };
    const receipt: unknown = await response.json();
    if (
      receipt &&
      typeof receipt === 'object' &&
      'imported' in receipt &&
      typeof receipt.imported === 'number' &&
      Number.isSafeInteger(receipt.imported) &&
      receipt.imported > 0 &&
      receipt.imported <= 1000
    )
      return { imported: receipt.imported };
  } catch {
    /* A lost receipt is safe to retry: the import replaces identical daily records. */
  }
  return { error: 'spendImportFailed' };
}
