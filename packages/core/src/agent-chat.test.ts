import { describe, expect, it } from 'vitest';
import { AGENT_TITLE_MAX, chatTitleFrom } from './agent-chat';

describe('chatTitleFrom', () => {
  it('collapses whitespace into one line', () => {
    expect(chatTitleFrom('  Make a 3D\n model\tof   this ')).toBe('Make a 3D model of this');
  });

  it('has no title for blank text', () => {
    expect(chatTitleFrom('   ')).toBeNull();
  });

  it('cuts a long first message to the title limit', () => {
    const title = chatTitleFrom('a'.repeat(200));
    expect(title).toHaveLength(AGENT_TITLE_MAX);
    expect(title?.endsWith('…')).toBe(true);
  });
});
