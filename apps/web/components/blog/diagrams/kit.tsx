import { ArrowDown, ArrowRight, type LucideIcon } from 'lucide-react';
import type { ReactNode, SVGProps } from 'react';
import { cn } from '@/lib/utils';

// Building blocks for the guide diagrams. Everything is drawn on the site's semantic tokens
// (foreground, muted, border, card), so a diagram follows the light or dark scheme with no
// `dark:` variant, and it is plain server HTML and inline SVG, readable without JavaScript.
// Chrome stays greyscale (DESIGN.md): emphasis is a stronger border or the foreground colour.

/** A box in a flow: an icon, a short title and an optional note. */
export function Node({
  icon: Icon,
  title,
  note,
  isStrong = false,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  note?: ReactNode;
  isStrong?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-md border bg-background px-3 py-2.5',
        isStrong && 'border-foreground/60',
        className,
      )}
    >
      <div className="flex items-start gap-2 text-sm font-medium leading-snug">
        {Icon && <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />}
        <span>{title}</span>
      </div>
      {note && <p className="mt-1 text-xs leading-snug text-muted-foreground">{note}</p>}
    </div>
  );
}

/** A small mono label, for a file name, a count or a step number. */
export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border bg-muted px-1.5 py-0.5 font-mono text-xs tabular-nums text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** An arrow between two flow steps: down on a phone, right from `sm` when `isRow` is set. */
export function FlowArrow({ isRow = false }: { isRow?: boolean }) {
  return (
    <div className="flex shrink-0 items-center justify-center text-muted-foreground" aria-hidden>
      <ArrowDown className={cn('size-4', isRow && 'sm:hidden')} />
      {isRow && <ArrowRight className="hidden size-4 sm:block" />}
    </div>
  );
}

/** A column heading inside a diagram. */
export function Heading({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{children}</p>
  );
}

/**
 * An inline SVG drawing. Its text is in SVG units, so the drawings keep a 560-unit-wide viewBox
 * and text of 22 units or more: in a 375 px phone (a 311 px drawing) that is still 12 px, and the
 * drawing stops at 448 px wide on a desktop so its text stays near the body size.
 */
export function Drawing({ viewBox, children, className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox={viewBox}
      className={cn('mx-auto block h-auto w-full max-w-md font-sans', className)}
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

/** SVG text in the foreground colour, or the muted one. */
export function Label({
  isMuted = false,
  className,
  ...props
}: SVGProps<SVGTextElement> & { isMuted?: boolean }) {
  return (
    <text
      fontSize={23}
      className={cn(isMuted ? 'fill-muted-foreground' : 'fill-foreground', className)}
      {...props}
    />
  );
}

// Shared stroke classes, so every drawing uses the same line weights.
export const LINE = 'fill-none stroke-foreground';
export const SOFT = 'fill-none stroke-muted-foreground';
export const SHAPE = 'fill-muted stroke-foreground';

/** A diagram and its words, per language. A guide in a language must find its words here. */
export type Diagram = { locales: string[]; render: (locale: string) => ReactNode };

export function defineDiagram<Copy>(
  copy: { en: Copy } & Partial<Record<string, Copy>>,
  Render: (props: { t: Copy }) => ReactNode,
): Diagram {
  return {
    locales: Object.keys(copy),
    render: (locale) => <Render t={(copy[locale] ?? copy.en) as Copy} />,
  };
}
