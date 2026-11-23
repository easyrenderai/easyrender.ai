import type { ComponentProps } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

const HEADING = 'mt-1 text-sm font-semibold text-foreground';

// A fenced block arrives as <pre><code>; an inline span arrives as <code> alone, so the block
// styles sit on the pre and the inline ones on the code that is not inside it.
const COMPONENTS: Components = {
  p: ({ node: _node, className, ...props }) => (
    <p className={cn('leading-relaxed', className)} {...props} />
  ),
  h1: ({ node: _node, ...props }) => <h3 className={HEADING} {...props} />,
  h2: ({ node: _node, ...props }) => <h3 className={HEADING} {...props} />,
  h3: ({ node: _node, ...props }) => <h3 className={HEADING} {...props} />,
  h4: ({ node: _node, ...props }) => <h4 className={HEADING} {...props} />,
  h5: ({ node: _node, ...props }) => <h4 className={HEADING} {...props} />,
  h6: ({ node: _node, ...props }) => <h4 className={HEADING} {...props} />,
  ul: ({ node: _node, ...props }) => (
    <ul className="flex list-disc flex-col gap-1 pl-5 marker:text-muted-foreground" {...props} />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol
      className="flex list-decimal flex-col gap-1 pl-5 marker:text-muted-foreground tabular-nums"
      {...props}
    />
  ),
  li: ({ node: _node, ...props }) => <li className="pl-1 leading-normal" {...props} />,
  strong: ({ node: _node, ...props }) => (
    <strong className="font-semibold text-foreground" {...props} />
  ),
  a: ({ node: _node, href, ...props }) => (
    <a
      href={href}
      className="font-medium underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      // A link from the model leaves the app in a new tab and tells that page nothing about us.
      target={href?.startsWith('/') ? undefined : '_blank'}
      rel="noopener noreferrer nofollow"
      {...props}
    />
  ),
  blockquote: ({ node: _node, ...props }) => (
    <blockquote className="border-l-2 pl-3 text-muted-foreground" {...props} />
  ),
  hr: () => <Separator />,
  pre: ({ node: _node, ...props }) => (
    <pre
      className="max-w-full overflow-x-auto rounded-lg border bg-card p-3 font-mono text-xs leading-relaxed text-card-foreground [&_code]:bg-transparent [&_code]:p-0"
      {...props}
    />
  ),
  code: ({ node: _node, className, ...props }) => (
    <code
      className={cn('rounded bg-muted px-1 py-0.5 font-mono text-xs break-words', className)}
      {...props}
    />
  ),
  table: ({ node: _node, ...props }: ComponentProps<'table'> & { node?: unknown }) => (
    <Table {...props} />
  ),
  thead: ({ node: _node, ...props }) => <TableHeader {...props} />,
  tbody: ({ node: _node, ...props }) => <TableBody {...props} />,
  tr: ({ node: _node, ...props }) => <TableRow {...props} />,
  th: ({ node: _node, ...props }) => <TableHead {...props} />,
  td: ({ node: _node, ...props }) => <TableCell className="whitespace-normal" {...props} />,
};

// The assistant writes Markdown. It is drawn here as text only: raw HTML in the reply stays
// inert (react-markdown does not parse it), unsafe link schemes are dropped by the library's
// default URL filter, and images are left out so a reply cannot load a remote pixel.
export function AgentMarkdown({ text, className }: { text: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex min-w-0 max-w-full flex-col gap-3 text-sm break-words [overflow-wrap:anywhere]',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={COMPONENTS}
        disallowedElements={['img']}
        unwrapDisallowed
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
