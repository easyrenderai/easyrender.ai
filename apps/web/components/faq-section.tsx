import { ChevronDownIcon } from 'lucide-react';
import { Section } from '@/components/landing';

export type FaqItem = { question: string; answer: string };

/** The questions block that closes the api, mcp and ecommerce landings: each question is a native `details`. */
export function FaqSection({ title, items }: { title: string; items: FaqItem[] }) {
  return (
    <Section id="faq" title={title} narrow>
      <div className="sec__column">
        {items.map((item) => (
          <details key={item.question} className="group border-b last:border-b-0">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-md py-5 text-left font-medium outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
              <h3 className="text-base font-medium">{item.question}</h3>
              <ChevronDownIcon
                className="size-4 shrink-0 translate-y-1 text-muted-foreground transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
