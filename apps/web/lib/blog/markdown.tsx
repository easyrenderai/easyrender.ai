import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BlogModel } from '@/components/blog/blog-model';
import { DIAGRAMS } from '@/components/blog/diagrams';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { versionedPublicModel } from '@/lib/public-models';
import { cn } from '@/lib/utils';
import { isFaqHeading } from './faq';
import { blogImageLayout, parseImage } from './images';
import { plainText } from './posts';

// Pictures, models, diagrams and tables carry `data-wide`: the page lets them run wider than the
// reading measure of the text around them.
//
// Renders the markdown subset the guides are written in: headings, paragraphs, lists, quotes,
// rules, tables, images, 3D models and drawn diagrams from the closed lists in images.ts, and
// inline emphasis, code and links. It returns React elements rather than HTML, so no
// post can inject markup into the page, and there is no markdown dependency to keep current.
//
// Anything outside the subset is shown as plain text instead of being dropped, which makes an
// unsupported construct obvious in review rather than silently invisible.

export type Block =
  | { kind: 'heading'; level: 2 | 3 | 4; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'media'; items: Media[] }
  | { kind: 'table'; header: string[]; rows: string[][] }
  | { kind: 'rule' };

/** A picture or a 3D model. Image lines with no blank line between them form one media block,
 * shown side by side, for a comparison such as a photo next to the model built from it. */
export type Media = {
  alt: string;
  src: string;
  caption?: string;
  width: number;
  height: number;
} & (
  | { type: 'image' }
  | { type: 'model'; poster: string; orbit: string }
  | { type: 'diagram'; name: string }
);

const HEADING = /^(#{2,4})\s+(.*)$/;
const UNORDERED = /^[-*]\s+(.*)$/;
const ORDERED = /^\d+[.)]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const RULE = /^(-{3,}|\*{3,}|_{3,})$/;
const TABLE_ROW = /^\|.*\|$/;
const TABLE_DIVIDER = /^\|(\s*:?-{3,}:?\s*\|)+$/;

const cells = (row: string) =>
  row
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());

function toMedia(line: string): Media | null {
  const image = parseImage(line);
  if (!image?.size) return null;
  const base = {
    alt: image.alt,
    src: image.src,
    ...(image.caption ? { caption: image.caption } : {}),
    width: image.size.width,
    height: image.size.height,
  };
  if (image.diagram) return { ...base, type: 'diagram', name: image.diagram };
  return image.model
    ? { ...base, type: 'model', poster: image.model.poster, orbit: image.model.orbit }
    : { ...base, type: 'image' };
}

/** Splits markdown into blocks. Exported for tests. */
export function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let index = 0;

  while (index < lines.length) {
    const line = (lines[index] as string).trim();
    if (!line) {
      index += 1;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ kind: 'rule' });
      index += 1;
      continue;
    }

    if (toMedia(line)) {
      const items: Media[] = [];
      while (index < lines.length) {
        const media = toMedia((lines[index] as string).trim());
        if (!media) break;
        items.push(media);
        index += 1;
      }
      blocks.push({ kind: 'media', items });
      continue;
    }

    // A table needs its header row and the |---| divider under it; anything else stays text.
    const divider = (lines[index + 1] ?? '').trim();
    if (TABLE_ROW.test(line) && TABLE_DIVIDER.test(divider)) {
      const header = cells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && TABLE_ROW.test((lines[index] as string).trim())) {
        rows.push(cells((lines[index] as string).trim()));
        index += 1;
      }
      blocks.push({ kind: 'table', header, rows });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({
        kind: 'heading',
        level: (heading[1] as string).length as 2 | 3 | 4,
        text: heading[2] as string,
      });
      index += 1;
      continue;
    }

    const listKind = UNORDERED.test(line) ? 'unordered' : ORDERED.test(line) ? 'ordered' : null;
    if (listKind) {
      const items: string[] = [];
      const pattern = listKind === 'unordered' ? UNORDERED : ORDERED;
      while (index < lines.length) {
        const match = pattern.exec((lines[index] as string).trim());
        if (!match) break;
        items.push(match[1] as string);
        index += 1;
      }
      blocks.push({ kind: 'list', ordered: listKind === 'ordered', items });
      continue;
    }

    if (QUOTE.test(line)) {
      const parts: string[] = [];
      while (index < lines.length) {
        const match = QUOTE.exec((lines[index] as string).trim());
        if (!match) break;
        parts.push(match[1] as string);
        index += 1;
      }
      blocks.push({ kind: 'quote', text: parts.join(' ').trim() });
      continue;
    }

    // A paragraph runs until a blank line or the start of another block.
    const parts: string[] = [];
    while (index < lines.length) {
      const next = (lines[index] as string).trim();
      if (!next || RULE.test(next) || HEADING.test(next) || QUOTE.test(next)) break;
      if (parts.length && parseImage(next)?.size) break;
      if (UNORDERED.test(next) || ORDERED.test(next)) break;
      parts.push(next);
      index += 1;
    }
    blocks.push({ kind: 'paragraph', text: parts.join(' ') });
  }

  return blocks;
}

// `**bold**`, `*italic*`, `` `code` `` and `[text](href)`, in one pass so nesting cannot loop.
const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

/**
 * Decides whether a site-relative link is shown as a link. Guides are written a week ahead and
 * link to each other, so a link to a guide that is not published yet is shown as plain text and
 * becomes a link on that guide's day, with no deploy and no 404 in between.
 */
export type LinkGate = (href: string) => boolean;
const ALWAYS: LinkGate = () => true;

const LINK =
  'font-medium underline decoration-foreground/30 underline-offset-4 transition-colors hover:decoration-foreground';

/** Turns inline markdown into React nodes. Exported for tests. */
export function renderInline(text: string, isLive: LinkGate = ALWAYS): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  for (const match of text.matchAll(INLINE)) {
    const token = match[0];
    const at = match.index;
    if (at > cursor) nodes.push(text.slice(cursor, at));
    cursor = at + token.length;
    key += 1;

    if (token.startsWith('**')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      nodes.push(
        <code key={key} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('[')) {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      if (!link) {
        nodes.push(token);
      } else {
        const href = link[2] as string;
        const label = link[1] as string;
        nodes.push(
          href.startsWith('/') && !isLive(href) ? (
            label
          ) : href.startsWith('/') ? (
            <Link key={key} href={href} className={LINK}>
              {label}
            </Link>
          ) : (
            <a key={key} href={href} rel="noopener noreferrer" target="_blank" className={LINK}>
              {label}
            </a>
          ),
        );
      }
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function Figure({
  media,
  hint,
  isLive,
  locale,
  isHero = false,
  isGrid = false,
}: {
  media: Media;
  hint: string;
  isLive: LinkGate;
  locale: string;
  isHero?: boolean;
  isGrid?: boolean;
}) {
  const imageLayout = blogImageLayout(media.width, isGrid);
  return (
    <figure className="min-w-0">
      {media.type === 'diagram' ? (
        // Drawn on the server from the site's tokens: the words are in the HTML, it needs no
        // JavaScript, and it follows the light or dark scheme. The alt text names the picture.
        <div
          role="img"
          aria-label={media.alt}
          className="rounded-xl border bg-card p-4 text-card-foreground sm:p-6"
        >
          {DIAGRAMS[media.name]?.render(locale)}
        </div>
      ) : media.type === 'model' ? (
        <BlogModel
          src={versionedPublicModel(media.src)}
          alt={media.alt}
          poster={{ src: media.poster, width: media.width, height: media.height }}
          orbit={media.orbit}
          hint={hint}
        />
      ) : (
        // The width and height reserve the space, so the text never jumps while it loads. Every
        // picture is lazy, except the illustration under the first paragraph, which is near the
        // top of every guide and often its largest paint, so it is preloaded.
        <Image
          src={versionedPublicModel(media.src)}
          alt={media.alt}
          width={media.width}
          height={media.height}
          {...(isHero ? { preload: true } : {})}
          sizes={imageLayout.sizes}
          quality={85}
          style={{ maxWidth: imageLayout.maxWidth }}
          className="mx-auto h-auto w-full rounded-xl border bg-muted"
        />
      )}
      {media.caption && (
        <figcaption className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">
          {renderInline(media.caption, isLive)}
        </figcaption>
      )}
    </figure>
  );
}

/** What a block needs from the page around it. */
type BlockContext = {
  hint: string;
  isLive: LinkGate;
  locale: string;
  /** The picture right under the first paragraph, the one image loaded straight away. */
  heroSrc?: string;
  /** The anchor of each `##` heading, the targets of the table of contents. */
  ids?: Map<Block, string>;
};

/** The source of the image directly under the first paragraph, or undefined. Exported for tests. */
export function heroSource(blocks: Block[]): string | undefined {
  const [first, second] = blocks;
  if (first?.kind !== 'paragraph' || second?.kind !== 'media' || second.items.length !== 1) return;
  const media = second.items[0] as Media;
  return media.type === 'image' ? media.src : undefined;
}

/** One block of a guide, as React. The FAQ items are rendered with this too, inside the accordion. */
function renderBlock(
  block: Block,
  key: string,
  { hint: modelHint, isLive, locale, heroSrc, ids }: BlockContext,
) {
  switch (block.kind) {
    case 'rule':
      return <Separator key={key} className="my-12" />;
    case 'media':
      return block.items.length === 1 ? (
        <div key={key} data-wide="" className="mt-10">
          <Figure
            media={block.items[0] as Media}
            hint={modelHint}
            isLive={isLive}
            locale={locale}
            isHero={(block.items[0] as Media).src === heroSrc}
          />
        </div>
      ) : (
        <div key={key} data-wide="" className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {block.items.map((media) => (
            <Figure
              key={media.src}
              media={media}
              hint={modelHint}
              isLive={isLive}
              locale={locale}
              isGrid
            />
          ))}
        </div>
      );
    case 'table':
      return (
        <div key={key} data-wide="" className="mt-10 overflow-hidden rounded-xl border">
          <Table className="min-w-xl">
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                {block.header.map((cell) => (
                  <TableHead
                    key={cell}
                    scope="col"
                    className="h-auto whitespace-normal px-4 py-3 align-bottom font-semibold"
                  >
                    {renderInline(cell, isLive)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {block.rows.map((row) => (
                <TableRow key={row.join('|')}>
                  {row.map((cell, column) =>
                    column === 0 ? (
                      <TableHead
                        key={cell}
                        scope="row"
                        className="whitespace-normal px-4 py-4 align-top font-semibold leading-relaxed"
                      >
                        {renderInline(cell, isLive)}
                      </TableHead>
                    ) : (
                      <TableCell
                        // biome-ignore lint/suspicious/noArrayIndexKey: static content, never reordered
                        key={column}
                        className={cn(
                          'whitespace-normal px-4 py-3 align-top leading-relaxed',
                          column === 0 ? 'font-medium' : 'text-muted-foreground',
                        )}
                      >
                        {renderInline(cell, isLive)}
                      </TableCell>
                    ),
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );
    case 'heading': {
      if (block.level === 2) {
        return (
          <h2
            key={key}
            id={ids?.get(block)}
            className="mt-16 scroll-mt-24 text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
          >
            {renderInline(block.text, isLive)}
          </h2>
        );
      }
      if (block.level === 3) {
        return (
          <h3 key={key} className="mt-10 text-xl font-semibold tracking-tight text-balance">
            {renderInline(block.text, isLive)}
          </h3>
        );
      }
      return (
        <h4 key={key} className="mt-8 text-lg font-semibold tracking-tight">
          {renderInline(block.text, isLive)}
        </h4>
      );
    }
    case 'list':
      return block.ordered ? (
        <ol
          key={key}
          className="mt-6 list-decimal space-y-3 pl-6 marker:text-muted-foreground marker:tabular-nums"
        >
          {block.items.map((item, position) => (
            // A rendered post never reorders: the list comes from the file, in file order,
            // so the position is the item's identity.
            // biome-ignore lint/suspicious/noArrayIndexKey: static content, never reordered
            <li key={`${key}-${position}`}>{renderInline(item, isLive)}</li>
          ))}
        </ol>
      ) : (
        <ul key={key} className="mt-6 list-disc space-y-3 pl-6 marker:text-muted-foreground">
          {block.items.map((item, position) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static content, never reordered
            <li key={`${key}-${position}`}>{renderInline(item, isLive)}</li>
          ))}
        </ul>
      );
    case 'quote':
      return (
        <blockquote
          key={key}
          className="my-10 border-l-2 border-foreground pl-6 text-lg font-medium leading-relaxed tracking-tight text-pretty sm:text-xl"
        >
          {renderInline(block.text, isLive)}
        </blockquote>
      );
    default:
      return (
        <p key={key} className="mt-6 text-pretty">
          {renderInline(block.text, isLive)}
        </p>
      );
  }
}

/** A question of the FAQ section and the blocks of its answer. */
export type FaqEntry = { question: string; blocks: Block[] };

/** The body as it is laid out: plain blocks, and the FAQ section gathered into one accordion. */
export type Section =
  | { kind: 'block'; block: Block }
  | { kind: 'faq'; heading: string; intro: Block[]; items: FaqEntry[] };

/**
 * Gathers the FAQ section, from its `## FAQ` heading to the next `## ` heading, into questions and
 * answers. It reads the same headings as faqFromBody (posts.ts), which builds the FAQPage
 * structured data, so the accordion and the JSON-LD always hold the same questions. Exported for
 * tests.
 */
export function sections(blocks: Block[]): Section[] {
  const result: Section[] = [];
  let faq: Extract<Section, { kind: 'faq' }> | null = null;
  for (const block of blocks) {
    if (block.kind === 'heading' && block.level === 2) {
      faq = isFaqHeading(block.text)
        ? { kind: 'faq', heading: block.text, intro: [], items: [] }
        : null;
      if (faq) {
        result.push(faq);
        continue;
      }
    }
    if (!faq) {
      result.push({ kind: 'block', block });
    } else if (block.kind === 'heading' && block.level === 3) {
      faq.items.push({ question: block.text, blocks: [] });
    } else {
      const current = faq.items.at(-1);
      if (current) current.blocks.push(block);
      else faq.intro.push(block);
    }
  }
  return result;
}

const NO_SCRIPT_FAQ = '[data-faq] [data-slot=accordion-content]{display:block}';

/**
 * The FAQ of a guide, always as an accordion (tone guide, section 5c). Every answer is mounted
 * while closed (`forceMount`) and only hidden with CSS, so it is in the server HTML that search
 * engines and AI crawlers read; without JavaScript, the noscript style shows them all. The
 * questions stay `h3`, inside the trigger.
 */
function Faq({
  section,
  context,
}: {
  section: Extract<Section, { kind: 'faq' }>;
  context: BlockContext;
}) {
  return (
    <section aria-labelledby="faq" data-faq="">
      <h2
        id="faq"
        className="mt-16 scroll-mt-24 text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
      >
        {renderInline(section.heading, context.isLive)}
      </h2>
      {section.intro.map((block, index) => renderBlock(block, `faq-intro-${index}`, context))}
      {/* Without JavaScript the accordion cannot open, so every answer is shown instead. */}
      <noscript>
        <style>{NO_SCRIPT_FAQ}</style>
      </noscript>
      <Accordion type="multiple" className="mt-8 rounded-xl border bg-card px-5 sm:px-6">
        {section.items.map((item, index) => (
          <AccordionItem key={item.question} value={`faq-${index}`}>
            <AccordionTrigger className="py-5 text-base font-medium hover:no-underline [&>svg]:translate-y-1">
              {renderInline(item.question, context.isLive)}
            </AccordionTrigger>
            <AccordionContent
              forceMount
              className="pb-5 text-base leading-relaxed text-muted-foreground [&>*:first-child]:mt-0"
            >
              {item.blocks.map((block, position) =>
                renderBlock(block, `faq-${index}-${position}`, context),
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

/** One entry of a post's table of contents: a `##` heading and its anchor. */
export type TocEntry = { id: string; text: string };

/** A heading as a URL fragment: lower case, no accents, words joined by hyphens. */
export const slugify = (text: string): string =>
  plainText(text)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

/**
 * The `##` headings of a post in order, each with a unique anchor. The FAQ keeps the `faq` id its
 * section has always had. Exported for tests and for the page's table of contents.
 */
export function tableOfContents(blocks: Block[]): { entries: TocEntry[]; ids: Map<Block, string> } {
  const used = new Set<string>(['faq']);
  const entries: TocEntry[] = [];
  const ids = new Map<Block, string>();
  for (const block of blocks) {
    if (block.kind !== 'heading' || block.level !== 2) continue;
    if (isFaqHeading(block.text)) {
      entries.push({ id: 'faq', text: plainText(block.text) });
      continue;
    }
    const base = slugify(block.text) || 'section';
    let id = base;
    for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
    used.add(id);
    ids.set(block, id);
    entries.push({ id, text: plainText(block.text) });
  }
  return { entries, ids };
}

/** The table of contents of a markdown body. */
export const tocOf = (source: string): TocEntry[] => tableOfContents(parseBlocks(source)).entries;

/** The article body of a post, as prose. `modelHint` labels a 3D model once it can be turned. */
export function Markdown({
  source,
  isLive = ALWAYS,
  modelHint = '',
  locale = 'en',
}: {
  source: string;
  isLive?: LinkGate;
  modelHint?: string;
  /** The guide's language, for the words inside diagrams. */
  locale?: string;
}) {
  const blocks = parseBlocks(source);
  const heroSrc = heroSource(blocks);
  const context: BlockContext = {
    hint: modelHint,
    isLive,
    locale,
    ids: tableOfContents(blocks).ids,
    ...(heroSrc ? { heroSrc } : {}),
  };
  return (
    <>
      {sections(blocks).map((section, index) =>
        section.kind === 'faq' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: static content, never reordered
          <Faq key={`faq-${index}`} section={section} context={context} />
        ) : (
          renderBlock(section.block, `${section.block.kind}-${index}`, context)
        ),
      )}
    </>
  );
}
