import { Camera, Images, PersonStanding } from 'lucide-react';

export type ChoiceCopy = {
  title: string;
  photo: { need: string; tools: string; check: string };
  views: { need: string; tools: string; check: string };
  animation: { need: string; tools: string; check: string };
};

/** An editorial shortlist by input and workflow, not an unmeasured quality ranking. */
export function ComparisonChoices({ copy }: { copy: ChoiceCopy }) {
  const items = [
    { ...copy.photo, Icon: Camera },
    { ...copy.views, Icon: Images },
    { ...copy.animation, Icon: PersonStanding },
  ];
  return (
    <section aria-label={copy.title} className="mb-10 rounded-xl border bg-card p-5 sm:p-6">
      <p className="mb-5 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        {copy.title}
      </p>
      <ul className="grid gap-5 sm:grid-cols-3 sm:gap-6">
        {items.map(({ need, tools, check, Icon }) => (
          <li key={need} className="border-t pt-4">
            <Icon className="mb-3 size-5 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">{need}</p>
            <p className="mt-2 text-lg font-semibold tracking-tight">{tools}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{check}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
