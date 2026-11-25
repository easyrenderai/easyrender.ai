import { describe, expect, it } from 'vitest';
import robots, { AI_AGENT_ALLOWED_PATHS, AI_CRAWLERS } from '@/app/robots';
import { NOINDEX_PREFIXES } from './noindex';
import { DISALLOWED_PREFIXES } from './routes';

describe('robots.txt', () => {
  const { rules } = robots();
  const groups = Array.isArray(rules) ? rules : [rules];
  const groupFor = (agent: string) =>
    groups.find((group) =>
      Array.isArray(group.userAgent) ? group.userAgent.includes(agent) : group.userAgent === agent,
    );

  it('lets every search engine crawl the noindex zones, so their noindex is read', () => {
    const all = groupFor('*');
    expect(all?.allow).toBe('/');
    for (const prefix of NOINDEX_PREFIXES.filter((path) => path !== '/admin'))
      expect(all?.disallow).not.toContain(prefix);
    expect(all?.disallow).toContain('/admin');
  });

  it.each(['GPTBot', 'OAI-SearchBot', 'PerplexityBot', 'ClaudeBot', 'Google-Extended'])(
    'allows %s on the site and keeps it out of the noindex zones',
    (agent) => {
      expect(AI_CRAWLERS).toContain(agent);
      const group = groupFor(agent);
      expect(group?.allow).toContain('/');
      for (const prefix of [...NOINDEX_PREFIXES, ...DISALLOWED_PREFIXES]) {
        expect(group?.disallow, prefix).toContain(prefix);
      }
    },
  );

  it('opens the MCP endpoint to AI agents and keeps the rest of /api/ and the app closed', () => {
    for (const agent of AI_CRAWLERS) {
      const group = groupFor(agent);
      expect(group?.allow, agent).toEqual(expect.arrayContaining(['/', '/api/mcp']));
      expect(group?.disallow, agent).toContain('/api/');
      expect(group?.disallow, agent).not.toContain('/api/mcp');
      for (const prefix of ['/admin', '/account', '/library', '/dashboard', '/connectors'])
        expect(group?.disallow, `${agent} ${prefix}`).toContain(prefix);
    }
    expect(AI_AGENT_ALLOWED_PATHS).toEqual(['/api/mcp']);
  });

  it('leaves the wildcard group as it was: /api/ stays closed, MCP clients ignore robots.txt', () => {
    const all = groupFor('*');
    expect(all?.allow).toBe('/');
    expect(all?.disallow).toContain('/api/');
  });

  it('does not block AI crawlers from the published comparisons', () => {
    expect(NOINDEX_PREFIXES).not.toContain('/compare');
    for (const agent of AI_CRAWLERS) {
      const group = groupFor(agent);
      expect(group?.disallow, agent).not.toContain('/compare');
    }
  });
});
