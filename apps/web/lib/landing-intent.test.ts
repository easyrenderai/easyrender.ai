import { expect, it } from 'vitest';
import { landingIntent } from './landing-intent';

it('takes format and interactive comparison readers to an inspectable model', () => {
  for (const group of ['glb-file', 'usdz-file', 'compare-360-vs-3d']) {
    expect(landingIntent(group, 'es')).toMatchObject({
      action: 'inspect',
      href: '/r/cmwceijqd000007l23vfjeftv',
    });
  }
});
it('keeps creation actions localized and safely falls back for new editorial groups', () => {
  expect(landingIntent('sell-vintage-furniture-online', 'es')).toEqual({
    key: 'commerce',
    href: '/es#try',
    action: 'upload',
  });
  expect(landingIntent('new-guide', 'en')).toEqual({
    key: 'photo',
    href: '/#try',
    action: 'upload',
  });
  expect(landingIntent('constructor', 'es').key).toBe('photo');
});
