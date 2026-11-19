// The messages the browser needs. NextIntlClientProvider would otherwise serialise every
// namespace into every page's RSC payload, including copy that only server components read
// (the home and landing sections, metadata, the FAQ, the connectors roadmap). Server components
// keep reading the full catalogue through getTranslations; only `useTranslations` calls, which
// can run in the browser, read from this subset. client-messages.test.ts scans the source and
// fails when a `useTranslations` namespace is missing here.

type Messages = { [key: string]: string | Messages };

export const CLIENT_NAMESPACES = [
  'ActivationErrors',
  'Analytics',
  'AdminGift',
  'ShopifyApp',
  'ShopifyConnect',
  'Ar',
  'Auth',
  'BuyButton',
  'Catalog',
  'ConnectorsPanel',
  'ConnectionCheck',
  'Converter.app',
  'AppHome',
  'AppShell',
  'DashboardNav',
  'Gallery',
  'Hub',
  'Library',
  'LocaleSwitcher',
  'McpSetup',
  'PaygPicker',
  'Pricing.calculator',
  'ProductViews',
  'Upscale',
  'Viewer.app',
  'PromptBar',
  'Render',
  'FirstModel',
  'Showcase',
  'Studio.hero',
  'Studio.industries',
  'Studio.lens',
  'Studio.pipeline',
  'Studio.shelf',
  'Studio.tools',
  'Studio.wheel',
] as const;

// Copies each listed path (a top-level namespace or a dotted sub-namespace) into a new tree.
export function pickClientMessages(
  messages: Messages,
  paths: readonly string[] = CLIENT_NAMESPACES,
) {
  const picked: Messages = {};
  for (const path of paths) {
    const keys = path.split('.');
    let source: string | Messages | undefined = messages;
    for (const key of keys) source = typeof source === 'object' ? source[key] : undefined;
    if (source === undefined) continue;
    let target = picked;
    for (const key of keys.slice(0, -1)) {
      const next = target[key];
      if (typeof next === 'object') {
        target = next;
      } else {
        const branch: Messages = {};
        target[key] = branch;
        target = branch;
      }
    }
    target[keys[keys.length - 1]] = source;
  }
  return picked;
}
