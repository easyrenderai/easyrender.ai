import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// Marketing pages are built once per pricing key and served from the edge cache. One read of the
// request in any layout above them (cookies, headers, the session) turns every page back into a
// per-visitor render and loses the cache with no test failing. This is that test.
const ROOT = join(__dirname, '..');
const FORBIDDEN = [
  /from ['"]next\/headers['"]/,
  /from ['"]@\/lib\/actor['"]/,
  /\bconnection\(\)/,
  /from ['"]@easyrender\/core['"]/,
];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '(account)' ? [] : sources(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const layouts = [
  'app/layout.tsx',
  'components/intl-boundary.tsx',
  'components/root-html.tsx',
  'components/site-chrome.tsx',
  'components/site-header.tsx',
  'components/site-footer.tsx',
  'components/shopify-bridge.tsx',
];

it.each(layouts)('%s does not read the request', (file) => {
  const source = readFileSync(join(ROOT, file), 'utf8');
  for (const pattern of FORBIDDEN)
    expect(source, `${file} matches ${pattern}`).not.toMatch(pattern);
});

it('no cacheable marketing route reads the request, outside the account pages', () => {
  const files = sources(join(ROOT, 'app/(marketing)'));
  expect(files.length).toBeGreaterThan(10);
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const pattern of FORBIDDEN)
      expect(source, `${file} matches ${pattern}`).not.toMatch(pattern);
  }
});

it('draws the root 404 without taking over the language of the request', () => {
  // A not-found file is rendered next to every page. If it set the request language it would turn
  // /es, /de and the rest into English pages with Spanish, German... messages in the provider only.
  const source = readFileSync(join(ROOT, 'app/not-found.tsx'), 'utf8');
  expect(source).toMatch(/<IntlBoundary[^>]*\bisFallback\b/);
});
