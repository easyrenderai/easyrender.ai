import { describe, expect, it } from 'vitest';
import { headerPrimaryAction } from './site-navigation';

describe('first-model navigation', () => {
  it('keeps commercial and editorial visitors on the photo workflow', () => {
    for (const path of ['/es/precios', '/es/comparativas/meshy', '/es/guias/fotos', '/hub']) {
      expect(headerPrimaryAction('es', path, false)).toEqual({ kind: 'upload', href: '/es#try' });
    }
  });
  it('retains the dedicated integration actions', () => {
    expect(headerPrimaryAction('es', '/es/mcp', false)).toEqual({
      kind: 'mcp',
      href: '/es/mcp#connect',
    });
    expect(headerPrimaryAction('es', '/es/api-imagen-a-3d', false)).toEqual({
      kind: 'api',
      href: '/es/api-imagen-a-3d#connect',
    });
  });
});
