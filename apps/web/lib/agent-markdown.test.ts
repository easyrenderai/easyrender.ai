import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AgentMarkdown } from '@/components/agent/agent-markdown';

const html = (text: string) => renderToStaticMarkup(createElement(AgentMarkdown, { text }));

describe('AgentMarkdown', () => {
  it('draws bold text and lists instead of the raw markers', () => {
    const out = html('You have **722 credits**.\n\n- **3D model:** Low 35\n- **Angle sheet:** 12');
    expect(out).toContain('<strong');
    expect(out).toContain('<ul');
    expect(out).toContain('<li');
    expect(out).not.toContain('**');
    expect(out).not.toContain('- ');
  });

  it('keeps raw HTML inert, drops images and unsafe link schemes', () => {
    const out = html(
      '<script>alert(1)</script>\n\n![x](https://evil.example/p.png) [bad](javascript:alert(1)) [ok](https://example.com)',
    );
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('javascript:');
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
  });

  it('opens a link inside the app in the same tab', () => {
    const out = html('[Pricing](/pricing)');
    expect(out).toContain('href="/pricing"');
    expect(out).not.toContain('target=');
  });

  it('draws a table with the shared table components and a fenced block as code', () => {
    const out = html('| Tier | Credits |\n| --- | --- |\n| Low | 35 |\n\n```\nrender_3d()\n```');
    expect(out).toContain('data-slot="table"');
    expect(out).toContain('<pre');
  });
});
