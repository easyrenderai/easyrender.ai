import { ArrowRight, ChevronDownIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export type ToolPageCopy = {
  formats: { title: string; description: string; items: { name: string; text: string }[] };
  steps: { title: string; items: { title: string; body: string }[] };
  /** The sibling tool: the viewer points at the converter and the converter at the viewer. */
  other: { body: string; action: string; href: string };
  cta: { title: string; body: string; action: string; href: string };
  faq: { title: string; items: { question: string; answer: string }[] };
};

/** The heading of a tool, rendered on the server and placed inside its stage. */
export function ToolIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="flex flex-col items-center gap-4">
      <Badge variant="outline">{eyebrow}</Badge>
      <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">{title}</h1>
      <p className="max-w-2xl text-lg text-muted-foreground text-pretty">{description}</p>
    </header>
  );
}

// The layout the free 3D tools share: the tool itself first, full width (`children`), then what
// it handles, how it works and the questions. Each tool passes its own words, already translated.
export function ToolPage({ copy, children }: { copy: ToolPageCopy; children: ReactNode }) {
  return (
    <>
      {children}
      <div className="mx-auto max-w-5xl px-4 pb-14 sm:px-6">
        <section className="mt-16 space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">{copy.formats.title}</h2>
            <p className="max-w-2xl text-muted-foreground text-pretty">
              {copy.formats.description}
            </p>
          </div>
          <ul className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
            {copy.formats.items.map((item) => (
              <li key={item.name} className="flex gap-4 bg-card p-4">
                <span className="w-12 shrink-0 font-mono text-sm font-medium">{item.name}</span>
                <span className="text-sm text-muted-foreground">{item.text}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            {copy.other.body}{' '}
            <Link
              href={copy.other.href}
              className="font-medium text-foreground underline underline-offset-4"
            >
              {copy.other.action}
            </Link>
          </p>
        </section>

        <section className="mt-16 space-y-6">
          <h2 className="text-2xl font-semibold tracking-tight">{copy.steps.title}</h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {copy.steps.items.map((step, index) => (
              <li key={step.title}>
                <Card className="h-full">
                  <CardHeader>
                    <CardDescription className="font-mono text-xs">
                      {String(index + 1).padStart(2, '0')}
                    </CardDescription>
                    <CardTitle className="text-base">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">{step.body}</CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16 flex flex-col items-start gap-4 rounded-xl border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">{copy.cta.title}</h2>
            <p className="max-w-xl text-sm text-muted-foreground">{copy.cta.body}</p>
          </div>
          <Button asChild>
            <Link href={copy.cta.href}>
              {copy.cta.action}
              <ArrowRight />
            </Link>
          </Button>
        </section>

        <section id="faq" className="mt-16 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">{copy.faq.title}</h2>
          {/* Native <details>, like the home FAQ: every answer stays in the server HTML. */}
          <div>
            {copy.faq.items.map((item) => (
              <details key={item.question} className="group border-b last:border-b-0">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-md py-4 text-left font-medium outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                  <h3 className="text-base font-medium">{item.question}</h3>
                  <ChevronDownIcon className="pointer-events-none size-4 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
