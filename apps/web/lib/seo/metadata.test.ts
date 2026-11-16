import { describe, expect, it } from 'vitest';
import { noindexMetadata, pageMetadata } from './metadata';

describe('search preview metadata', () => {
  it('allows large image previews for public content', () => {
    expect(
      pageMetadata({
        locale: 'en',
        path: '/learn/example',
        title: 'Example',
        description: 'A guide.',
      }).robots,
    ).toEqual({ index: true, follow: true, 'max-image-preview': 'large' });
  });

  it('keeps private and advertising pages noindex without a preview opt-in', () => {
    expect(noindexMetadata('Account').robots).toEqual({ index: false, follow: true });
  });
});
