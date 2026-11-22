// Read at call time so builds and tests do not need every secret.
export const config = {
  appUrl: () =>
    (process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:3000').replace(
      /\/$/,
      '',
    ),
  replicateToken: () => process.env.REPLICATE_API_TOKEN ?? '',
  // The Agent chat is off until this is set; the rest of the app does not need it.
  anthropicKey: () => process.env.ANTHROPIC_API_KEY ?? '',
  // Read-only token for the private easyrenderai/harness repo. Without it the defaults are used.
  harnessToken: () => process.env.HARNESS_GITHUB_TOKEN ?? '',
  sheetEnabled: () => process.env.SHEET_ENABLED !== 'false',
  freePreviewsPerDay: () => Number(process.env.FREE_PREVIEWS_PER_DAY ?? 2),
  paidPreviewsPerDay: () => Number(process.env.PAID_PREVIEWS_PER_DAY ?? 30),
  isProduction: () => process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV !== 'preview',
  // Replicate can only call back a public https URL.
  webhookUrl: (path: string) => {
    const base = config.appUrl();
    return base.startsWith('https://') ? `${base}${path}` : undefined;
  },
};
