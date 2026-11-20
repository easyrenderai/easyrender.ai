// Fails when a raw HTML control appears in apps/web. Product UI uses the shadcn components in
// apps/web/components/ui (see DESIGN.md). The allowlist holds the controls that already existed
// when this guard landed; counts only go down. Never raise one: use a shadcn component instead.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SCAN = join(ROOT, 'apps/web');
const SKIP_DIRS = new Set(['node_modules', '.next', 'generated', 'ui']);
const RAW = /<(button|input|textarea|select|dialog|table|hr)(?=[\s/>])/g;

// path (relative to repo root) -> number of raw controls tolerated
const ALLOWLIST: Record<string, number> = {
  // Marketing studio carousel and hub controls styled by studio.css.
  'apps/web/components/studio/shelf.tsx': 2,
  'apps/web/components/studio/hub.tsx': 10,
  // Existing raw controls still to move onto components/ui.
  'apps/web/components/catalog-library.tsx': 1,
  // Hidden field carrying the OAuth query string.
  'apps/web/app/(marketing)/(account)/oauth/authorize/page.tsx': 1,
};

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (path.endsWith('.tsx')) yield path;
  }
}

const failures: string[] = [];
for (const file of walk(SCAN)) {
  const rel = relative(ROOT, file);
  const found = readFileSync(file, 'utf8').match(RAW)?.length ?? 0;
  const allowed = ALLOWLIST[rel] ?? 0;
  if (found > allowed) {
    failures.push(
      `${rel}: ${found} raw control(s), ${allowed} allowed. Use a component from components/ui.`,
    );
  } else if (found < allowed) {
    failures.push(
      `${rel}: ${found} raw control(s) left, allowlist says ${allowed}. Lower the allowlist entry.`,
    );
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('ui guards: ok');
