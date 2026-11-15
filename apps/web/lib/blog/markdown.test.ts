import { describe, expect, it } from 'vitest';
import { parseBlocks, renderInline, slugify, tableOfContents, tocOf } from './markdown';

describe('the markdown subset the guides are written in', () => {
  it('reads headings, paragraphs, lists, quotes and rules', () => {
    const blocks = parseBlocks(
      [
        '## What you get',
        '',
        'A textured GLB.',
        'And a USDZ.',
        '',
        '1. Upload one photo.',
        '2. Check every angle.',
        '',
        '- GLB',
        '- USDZ',
        '',
        '> Previews are free.',
        '',
        '---',
        '',
        '### Fine print',
      ].join('\n'),
    );

    expect(blocks).toEqual([
      { kind: 'heading', level: 2, text: 'What you get' },
      // Soft-wrapped lines join into one paragraph, as markdown does.
      { kind: 'paragraph', text: 'A textured GLB. And a USDZ.' },
      { kind: 'list', ordered: true, items: ['Upload one photo.', 'Check every angle.'] },
      { kind: 'list', ordered: false, items: ['GLB', 'USDZ'] },
      { kind: 'quote', text: 'Previews are free.' },
      { kind: 'rule' },
      { kind: 'heading', level: 3, text: 'Fine print' },
    ]);
  });

  it('starts a new block as soon as one begins, without a blank line', () => {
    expect(parseBlocks('Some words.\n## A heading')).toEqual([
      { kind: 'paragraph', text: 'Some words.' },
      { kind: 'heading', level: 2, text: 'A heading' },
    ]);
  });

  it('has nothing to render for an empty body', () => {
    expect(parseBlocks('\n\n   \n')).toEqual([]);
  });

  it('shows a known image with its real size and caption, and leaves an unknown one as text', () => {
    expect(parseBlocks('![The input photo](/showcase/armchair.jpg "One photo")')).toEqual([
      {
        kind: 'media',
        items: [
          {
            type: 'image',
            alt: 'The input photo',
            src: '/showcase/armchair.jpg',
            caption: 'One photo',
            width: 2048,
            height: 2048,
          },
        ],
      },
    ]);
    expect(parseBlocks('![Invented](/made-up.jpg)')).toEqual([
      { kind: 'paragraph', text: '![Invented](/made-up.jpg)' },
    ]);
  });

  it('shows a known GLB as a 3D model with its real poster, and an unknown one as text', () => {
    expect(parseBlocks('![The armchair in 3D](/showcase/armchair.glb)')).toEqual([
      {
        kind: 'media',
        items: [
          {
            type: 'model',
            alt: 'The armchair in 3D',
            src: '/showcase/armchair.glb',
            poster: '/blog/models/armchair.webp',
            orbit: '30deg 75deg auto',
            width: 960,
            height: 960,
          },
        ],
      },
    ]);
    expect(parseBlocks('![Invented](/showcase/made-up.glb)')).toEqual([
      { kind: 'paragraph', text: '![Invented](/showcase/made-up.glb)' },
    ]);
  });

  it('puts image lines with no blank line between them side by side, and splits them otherwise', () => {
    const pair = '![The photo](/showcase/armchair.jpg)\n![The model](/showcase/armchair.glb)';
    const [together] = parseBlocks(pair);
    expect(together?.kind === 'media' && together.items.map((item) => item.type)).toEqual([
      'image',
      'model',
    ]);
    expect(parseBlocks(pair.replace('\n', '\n\n')).map((block) => block.kind)).toEqual([
      'media',
      'media',
    ]);
  });

  it('reads a table with a header and a divider, and leaves pipes without a divider as text', () => {
    expect(
      parseBlocks('| Format | Opens on |\n| --- | --- |\n| GLB | Android |\n| USDZ | iPhone |'),
    ).toEqual([
      {
        kind: 'table',
        header: ['Format', 'Opens on'],
        rows: [
          ['GLB', 'Android'],
          ['USDZ', 'iPhone'],
        ],
      },
    ]);
    expect(parseBlocks('| not | a table |')).toEqual([
      { kind: 'paragraph', text: '| not | a table |' },
    ]);
  });

  it('shows a link to a guide that is not out yet as its text, and other links as links', () => {
    const isLive = (href: string) => href !== '/learn/later';
    const nodes = renderInline('See [the later guide](/learn/later) or [the home](/).', isLive);
    expect(nodes[1]).toBe('the later guide');
    expect(typeof nodes[3]).toBe('object');
  });
});

describe('the table of contents', () => {
  it('turns a heading into a plain URL fragment', () => {
    expect(slugify('Step 1: Pick the right photo')).toBe('step-1-pick-the-right-photo');
    expect(slugify('¿Qué **resolución** necesita la foto?')).toBe(
      'que-resolucion-necesita-la-foto',
    );
    expect(slugify('[GLB](/learn/glb-file) vs `USDZ`')).toBe('glb-vs-usdz');
  });

  it('lists the ## headings in order, keeps the faq anchor and never repeats an id', () => {
    const source = [
      '## Why',
      'Text.',
      '### Not listed',
      '## Why',
      '## FAQ!',
      'Intro.',
      '## FAQ',
      '### A question?',
      'An answer.',
    ].join('\n\n');
    expect(tocOf(source)).toEqual([
      { id: 'why', text: 'Why' },
      { id: 'why-2', text: 'Why' },
      { id: 'faq-2', text: 'FAQ!' },
      { id: 'faq', text: 'FAQ' },
    ]);
  });

  it('gives the rendered heading blocks the same ids the contents link to', () => {
    const blocks = parseBlocks('## One\n\nText.\n\n## Two');
    const { entries, ids } = tableOfContents(blocks);
    expect(blocks.filter((block) => ids.has(block)).map((block) => ids.get(block))).toEqual(
      entries.map((entry) => entry.id),
    );
  });
});
