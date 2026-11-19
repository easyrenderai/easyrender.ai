// A deliberately small YAML-ish front matter reader: `key: value` scalars only, with optional
// quotes. Post front matter never needs lists or nesting, and a tiny parser is one less
// dependency between a reviewed text file and the page it becomes.

export type FrontMatter = { data: Record<string, string>; body: string };

const DELIMITER = '---';

export function parseFrontMatter(source: string): FrontMatter {
  const text = source.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  if (!text.startsWith(`${DELIMITER}\n`)) return { data: {}, body: text.trim() };

  const end = text.indexOf(`\n${DELIMITER}`, DELIMITER.length);
  if (end === -1) return { data: {}, body: text.trim() };

  const data: Record<string, string> = {};
  for (const line of text.slice(DELIMITER.length + 1, end).split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colon = trimmed.indexOf(':');
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();
    if (key) data[key] = unquote(value);
  }

  const bodyStart = text.indexOf('\n', end + 1 + DELIMITER.length);
  return { data, body: bodyStart === -1 ? '' : text.slice(bodyStart + 1).trim() };
}

function unquote(value: string): string {
  const quoted = /^(["'])(.*)\1$/.exec(value);
  return quoted ? (quoted[2] as string) : value;
}

export const parseContentDate = (value: string): string | null => {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
