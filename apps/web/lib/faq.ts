// The home FAQ, in the order the page shows it. Pure, so the page, the FAQPage structured data and
// llms-full.txt all read the same list. Keep the home focused on the six decisions a new
// customer needs to make; introductory and agent-specific details belong on their own pages.
export const FAQ_KEYS = ['freePreview', 'cost', 'formats', 'scope', 'failed', 'public'] as const;
