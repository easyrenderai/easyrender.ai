import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import {
  article,
  breadcrumbList,
  faqPage,
  organization,
  softwareApplication,
  webPage,
  website,
} from './jsonld';
import { faqText } from './llms';
import { SITE_URL } from './site';

// A local stand-in for the Rich Results Test and the schema.org validator, which need a public
// URL: the required properties of each node, @id references that resolve inside the graph, and
// nothing claims.md forbids in structured data.

type Node = Record<string, unknown>;

const homeGraph = (): Node[] => [
  organization(),
  website('en'),
  webPage('en', '/', en.Home.meta.title, en.Home.meta.description),
  softwareApplication('en', en.Home.meta.description),
  faqPage(faqText('en')),
];

function references(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) for (const item of value) references(item, found);
  else if (value && typeof value === 'object') {
    const node = value as Node;
    const keys = Object.keys(node);
    if (keys.length === 1 && keys[0] === '@id') found.push(node['@id'] as string);
    else for (const child of Object.values(node)) references(child, found);
  }
  return found;
}

describe('home structured data', () => {
  const graph = homeGraph();
  const byType = (type: string) => graph.find((node) => node['@type'] === type) as Node;

  it('serialises to valid JSON with a schema.org context', () => {
    const payload = JSON.parse(
      JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }),
    );
    expect(payload['@graph']).toHaveLength(5);
  });

  it('resolves every @id reference inside the graph', () => {
    const ids = new Set(graph.map((node) => node['@id']).filter(Boolean));
    for (const id of references(graph)) expect(ids.has(id), id).toBe(true);
  });

  it('gives Organization, WebSite and WebPage their required properties', () => {
    expect(byType('Organization')).toMatchObject({ name: 'easyrender', url: SITE_URL });
    expect(byType('WebSite')).toMatchObject({
      name: 'easyrender',
      url: SITE_URL,
      inLanguage: 'en',
    });
    expect(byType('WebPage')).toMatchObject({ url: SITE_URL, inLanguage: 'en' });
  });

  it('gives SoftwareApplication offers with a numeric price and a currency', () => {
    const app = byType('SoftwareApplication');
    expect(app).toMatchObject({ applicationCategory: expect.any(String), operatingSystem: 'Web' });
    const offers = app.offers as Node[];
    expect(offers.length).toBeGreaterThan(0);
    for (const offer of offers) {
      expect(offer['@type']).toBe('Offer');
      expect(String(offer.price)).toMatch(/^\d+(\.\d+)?$/);
      expect(offer.priceCurrency).toBe('USD');
    }
  });

  it('builds the FAQPage from the visible FAQ, one Question per item', () => {
    const faq = byType('FAQPage');
    const questions = faq.mainEntity as Node[];
    expect(questions).toHaveLength(faqText('en').length);
    for (const question of questions) {
      expect(question['@type']).toBe('Question');
      expect(question.name).toBeTruthy();
      expect((question.acceptedAnswer as Node)['@type']).toBe('Answer');
      expect((question.acceptedAnswer as Node).text).toBeTruthy();
    }
  });

  it('carries no rating, review or size: claims.md forbids them', () => {
    const json = JSON.stringify(graph);
    for (const key of ['aggregateRating', 'review', 'width', 'height', 'depth', 'weight']) {
      expect(json, key).not.toContain(`"${key}"`);
    }
  });
});

describe('guide structured data', () => {
  it('numbers breadcrumbs from 1 with absolute URLs', () => {
    const list = breadcrumbList([
      { name: 'Home', path: '/' },
      { name: 'Guides', path: '/learn' },
    ]);
    expect(list.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Guides', item: `${SITE_URL}/learn` },
    ]);
  });

  it('gives a BlogPosting its headline, dates, image and publisher', () => {
    const node = article({
      locale: 'en',
      title: 'GLB or USDZ?',
      description: 'Which one to use.',
      date: '2026-11-23T00:00:00.000Z',
      path: '/learn/glb-vs-usdz',
    });
    expect(node).toMatchObject({
      '@type': 'BlogPosting',
      '@id': `${SITE_URL}/learn/glb-vs-usdz#article`,
      headline: 'GLB or USDZ?',
      datePublished: '2026-11-23T00:00:00.000Z',
      dateModified: '2026-11-23T00:00:00.000Z',
      image: { '@type': 'ImageObject', url: `${SITE_URL}/og.jpg`, width: 1200, height: 630 },
      publisher: { '@id': `${SITE_URL}/#organization` },
    });
  });

  it('signs a guide with no agreed author as the easyrender team, an Organization', () => {
    const node = article({
      locale: 'en',
      title: 'GLB or USDZ?',
      description: 'Which one to use.',
      date: '2026-11-23T00:00:00.000Z',
      path: '/learn/glb-vs-usdz',
    });
    expect(node.author).toEqual({
      '@type': 'Organization',
      name: 'easyrender team',
      url: SITE_URL,
      parentOrganization: { '@id': `${SITE_URL}/#organization` },
    });
  });

  it('signs a guide as a Person only when the post names one', () => {
    const node = article({
      locale: 'en',
      title: 'GLB or USDZ?',
      description: 'Which one to use.',
      date: '2026-11-23T00:00:00.000Z',
      path: '/learn/glb-vs-usdz',
      author: { name: 'A Writer', type: 'Person', url: '/about' },
    });
    expect(node.author).toEqual({ '@type': 'Person', name: 'A Writer', url: `${SITE_URL}/about` });
  });

  it('never dates a change before the publication, for a post edited ahead of its day', () => {
    const node = article({
      locale: 'en',
      title: 'GLB or USDZ?',
      description: 'Which one to use.',
      date: '2026-11-23T00:00:00.000Z',
      updated: '2026-11-10T00:00:00.000Z',
      path: '/learn/glb-vs-usdz',
    });
    expect(node.dateModified).toBe('2026-11-23T00:00:00.000Z');
  });
});

it('advertises only PAYG and Pro priced offers in either experiment arm', () => {
  for (const variant of ['control', 'test'] as const) {
    const offers = softwareApplication('en', 'Pricing', variant).offers as Node[];
    expect(offers.map((offer) => offer.name)).toEqual(['Pay as you go', 'Pro']);
  }
});
