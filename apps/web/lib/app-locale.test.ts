import { NextRequest } from 'next/server';
import { expect, it } from 'vitest';
import { proxy } from '@/proxy';
import { authProjectPath, localizedAuthPath } from './app-locale';

const request = (path: string, cookie = '') =>
  new NextRequest(`https://easyrender.ai${path}`, {
    headers: { accept: 'text/html', 'sec-fetch-dest': 'document', cookie },
  });

it('remembers the language of a direct visit to a localized landing for the creation journey', async () => {
  const landing = await proxy(request('/es/precios'));
  const preference = landing.cookies.get('er_app_locale')?.value;
  expect(preference).toBe('es');
  for (const path of ['/dashboard', '/r/example', '/credits?next=%2Fr%2Fexample', '/views']) {
    const response = await proxy(request(path, `er_app_locale=${preference}`));
    expect(response.headers.get('x-middleware-request-x-easyrender-locale')).toBe('es');
  }
});

it('keeps indexed pages in the language of their URL and honors an explicit app choice', async () => {
  const preferred = 'er_app_locale=es';
  for (const [path, locale] of [
    ['/pricing?locale=de', 'en'],
    ['/fr/tarifs?locale=de', 'fr'],
    ['/credits?locale=de', 'de'],
    ['/forgot-password?locale=pt', 'pt'],
    ['/r/example?locale=xx', 'es'],
  ]) {
    const response = await proxy(request(path, preferred));
    expect(response.headers.get('x-middleware-request-x-easyrender-locale')).toBe(locale);
  }
});

it('only uses supported auth paths for the selected language', () => {
  expect(localizedAuthPath('pt', '/sign-up')).toBe('/pt/sign-up');
  expect(localizedAuthPath('en', '/sign-in')).toBe('/sign-in');
  expect(localizedAuthPath('invalid', '/sign-in')).toBe('/sign-in');
});

it('resumes only a canonical invitation and rejects action or external variants', () => {
  const path = '/invite/61e709c0-00d9-4a88-8773-c2f33e2744f3';
  expect(authProjectPath(path)).toBe(path);
  for (const invalid of [
    `${path}/more`,
    `${path}?x=1`,
    '/invite/anything',
    `//other.test${path}`,
  ]) {
    expect(authProjectPath(invalid)).toBeNull();
  }
});
