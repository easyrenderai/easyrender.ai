const SERVICE_EMAIL_LOCALES = ['en', 'es', 'de', 'fr', 'it', 'pt'] as const;
export type ServiceEmailLocale = (typeof SERVICE_EMAIL_LOCALES)[number];

export function isServiceEmailLocale(value: unknown): value is ServiceEmailLocale {
  return typeof value === 'string' && (SERVICE_EMAIL_LOCALES as readonly string[]).includes(value);
}
