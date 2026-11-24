import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { GOOGLE_TAG_BOOTSTRAP } from './google-tag';

function browser(hostname = 'easyrender.ai') {
  const scripts: Array<{ src?: string; async?: boolean }> = [];
  const dataLayer: unknown[] = [{ event: 'existing-event' }];
  const window = {
    location: {
      hostname,
      origin: `https://${hostname}`,
      pathname: '/es',
      search: '?email=private@example.com',
      hash: '#private',
    },
    dataLayer,
  };
  const context = {
    window,
    navigator: { userAgent: 'Mozilla/5.0 Chrome/130.0', webdriver: false },
    document: {
      referrer: 'https://example.com/?token=private',
      createElement: () => ({}),
      head: { appendChild: (script: { src?: string; async?: boolean }) => scripts.push(script) },
    },
    URL,
  };
  return { context, scripts, dataLayer, run: () => runInNewContext(GOOGLE_TAG_BOOTSTRAP, context) };
}

const commands = (dataLayer: unknown[]) =>
  dataLayer.slice(1).map((entry) => Array.from(entry as ArrayLike<unknown>));

describe('Google Ads base tag', () => {
  it('loads the account tag once and preserves the existing data layer', () => {
    const page = browser();
    page.run();
    page.run();
    expect(page.scripts).toEqual([
      { async: true, src: 'https://www.googletagmanager.com/gtm.js?id=AW-18570382360' },
    ]);
    expect(page.context.window.dataLayer).toBe(page.dataLayer);
    expect(page.dataLayer[0]).toEqual({ event: 'existing-event' });
    expect(commands(page.dataLayer).filter(([command]) => command === 'js')).toHaveLength(1);
  });

  it.each(['localhost', 'preview.vercel.app', 'easyrender.ai.example.com'])(
    'does not load on %s',
    (hostname) => {
      const page = browser(hostname);
      page.run();
      expect(page.scripts).toEqual([]);
      expect(page.dataLayer).toEqual([{ event: 'existing-event' }]);
    },
  );

  it('denies storage and advertising consent before initializing measurement', () => {
    const page = browser();
    page.run();
    expect(commands(page.dataLayer)[0]).toEqual([
      'consent',
      'default',
      {
        ad_storage: 'denied',
        analytics_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      },
    ]);
    expect(commands(page.dataLayer)).toContainEqual(['set', 'ads_data_redaction', true]);
    expect(commands(page.dataLayer)).toContainEqual(['set', 'url_passthrough', false]);
    expect(commands(page.dataLayer).some(([command]) => command === 'event')).toBe(false);
  });

  it('uses URLs without private query strings or fragments', () => {
    const page = browser();
    page.run();
    expect(commands(page.dataLayer)).toContainEqual([
      'set',
      {
        page_location: 'https://easyrender.ai/es',
        page_referrer: 'https://example.com/',
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      },
    ]);
    expect(JSON.stringify(commands(page.dataLayer))).not.toContain('private');
  });
});

it('keeps campaign parameters in the denied-consent bootstrap while stripping click IDs', () => {
  const page = browser();
  page.context.window.location.search =
    '?utm_source=google&utm_medium=cpc&utm_campaign=niche&utm_content=ad&utm_term=model&gclid=Click_1&gbraid=Click_2&wbraid=Click_3&email=private&token=secret';
  page.run();
  expect(commands(page.dataLayer)).toContainEqual([
    'set',
    expect.objectContaining({
      page_location:
        'https://easyrender.ai/es?utm_source=google&utm_medium=cpc&utm_campaign=niche&utm_content=ad&utm_term=model',
    }),
  ]);
  expect(JSON.stringify(commands(page.dataLayer))).not.toMatch(/Click_|private|secret/);
});
