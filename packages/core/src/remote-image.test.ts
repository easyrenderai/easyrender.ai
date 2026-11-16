import { describe, expect, it } from 'vitest';
import { parseCatalogItems } from './catalog';
import { fetchRemoteImage, isPrivateAddress } from './remote-image';

describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '2002:7f00:1::',
    '2001:db8::1',
    '::',
    'ff02::1',
  ])('refuses %s', (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each([
    '8.8.8.8',
    '172.32.0.1',
    '151.101.1.1',
    '2606:4700::1111',
    '2001:4860:4860::8888',
    '::ffff:0808:0808',
  ])('allows %s', (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  });
});

describe('fetchRemoteImage', () => {
  it.each([
    'http://cdn.shop.test/a.jpg',
    'https://127.0.0.1/a.jpg',
    'https://169.254.169.254/latest/meta-data',
    'https://[::1]/a.jpg',
    'https://cdn.shop.test:8443/a.jpg',
    'not a url',
  ])('refuses %s before any request is made', async (url) => {
    await expect(fetchRemoteImage(url)).rejects.toMatchObject({ status: 400, code: 'bad_url' });
  });
});

describe('parseCatalogItems', () => {
  const item = { externalId: '12', title: ' Oak chair ', imageUrl: 'https://cdn.shop.test/a.jpg' };

  it('trims, defaults the title to the id and drops empty notes', () => {
    expect(parseCatalogItems([item, { ...item, externalId: '13', title: '', note: '  ' }])).toEqual(
      [
        { externalId: '12', title: 'Oak chair', imageUrl: item.imageUrl },
        { externalId: '13', title: '13', imageUrl: item.imageUrl },
      ],
    );
  });

  it.each([
    [[]],
    ['nope'],
    [[{ ...item, externalId: '' }]],
    [[{ ...item, imageUrl: 'http://cdn.shop.test/a.jpg' }]],
    [[item, item]],
    [Array.from({ length: 101 }, (_, n) => ({ ...item, externalId: String(n) }))],
  ])('rejects %j', (value) => {
    expect(() => parseCatalogItems(value)).toThrowError(/product|externalId|imageUrl|listed/i);
  });
});
