export const UPSCALE_POLL_MS = 3000;

// How long to wait before asking for the enlargements again: only while one is still processing.
export function upscalePollInterval(rows: ReadonlyArray<{ status: string }> | undefined) {
  return rows?.some((row) => row.status === 'processing') ? UPSCALE_POLL_MS : false;
}
