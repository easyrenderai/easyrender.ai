import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import de from '@/messages/de.json';
import en from '@/messages/en.json';
import es from '@/messages/es.json';
import fr from '@/messages/fr.json';
import itMessages from '@/messages/it.json';
import pt from '@/messages/pt.json';
import { CLIENT_NAMESPACES, pickClientMessages } from './client-messages';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SOURCE_DIRS = ['app', 'components', 'lib', 'i18n'];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

// Every `useTranslations(...)` in the app: these are the calls that can run in the browser.
const calls = SOURCE_DIRS.flatMap((dir) => sourceFiles(join(ROOT, dir))).flatMap((file) =>
  [...readFileSync(file, 'utf8').matchAll(/useTranslations\(([^)]*)\)/g)].map((match) => ({
    file: file.slice(ROOT.length),
    arg: match[1].trim(),
  })),
);

const lookup = (messages: unknown, path: string) =>
  path
    .split('.')
    .reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], messages);

describe('client messages', () => {
  it('finds the useTranslations calls it guards', () => {
    expect(calls.length).toBeGreaterThan(20);
  });

  it('names every namespace a useTranslations call reads', () => {
    for (const { file, arg } of calls) {
      // A call without a literal namespace could read anything, so it is not allowed.
      expect(arg, `${file}: useTranslations needs a literal namespace`).toMatch(/^'[\w.]+'$/);
      const namespace = arg.slice(1, -1);
      const covered = CLIENT_NAMESPACES.some(
        (path) => namespace === path || namespace.startsWith(`${path}.`),
      );
      expect(covered, `${file}: add '${namespace}' to CLIENT_NAMESPACES`).toBe(true);
    }
  });

  it('sends the client namespaces in every language, with the same copy', () => {
    for (const messages of [en, es, de, fr, itMessages, pt]) {
      const picked = pickClientMessages(messages);
      for (const path of CLIENT_NAMESPACES) {
        expect(lookup(picked, path), path).toEqual(lookup(messages, path));
      }
    }
  });

  it('leaves server-only copy out of the browser payload', () => {
    const picked = pickClientMessages(en);
    for (const namespace of [
      'Landing',
      'Home',
      'Metadata',
      'Connectors',
      'Credits',
      'Blog',
      'AgentDemo',
    ]) {
      expect(picked).not.toHaveProperty(namespace);
    }
    expect(lookup(picked, 'Studio.cta')).toBeUndefined();
    expect(JSON.stringify(picked)).not.toContain('embed models with a snippet');
    expect(JSON.stringify(picked).length).toBeLessThan(JSON.stringify(en).length * 0.8);
  });
});
