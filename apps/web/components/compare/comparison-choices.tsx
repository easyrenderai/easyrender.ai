import { Camera, Images, ScanLine } from 'lucide-react';
import Image from 'next/image';

export type ChoiceCopy = {
  title: string;
  photo: { need: string; tools: string; check: string };
  views: { need: string; tools: string; check: string };
  animation: { need: string; tools: string; check: string };
};

/** A shortlist by available input, never an unmeasured quality score. */
export function ComparisonChoices({ copy }: { copy: ChoiceCopy }) {
  return (
    <section aria-label={copy.title} className="mb-14" data-comparison-choices="">
      <p className="mb-5 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        {copy.title}
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        <li className="overflow-hidden rounded-2xl border bg-card sm:col-span-2">
          <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_12rem] sm:p-7">
            <div>
              <Camera className="mb-4 size-5 text-muted-foreground" aria-hidden />
              <p className="text-xl leading-tight font-semibold tracking-tight sm:text-2xl">
                {copy.photo.need}
              </p>
              <p className="mt-3 text-base font-medium">{copy.photo.tools}</p>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                {copy.photo.check}
              </p>
            </div>
            <Image
              src="/showcase/vase.jpg"
              alt=""
              width={720}
              height={720}
              sizes="(min-width: 640px) 192px, 112px"
              className="h-auto w-full rounded-xl"
            />
          </div>
        </li>
        {[
          { ...copy.views, Icon: Images },
          { ...copy.animation, Icon: ScanLine },
        ].map(({ need, tools, check, Icon }) => (
          <li key={need} className="rounded-2xl border bg-muted/30 p-5 sm:p-7">
            <Icon className="mb-5 size-5 text-muted-foreground" aria-hidden />
            <p className="text-lg leading-snug font-semibold tracking-tight">{need}</p>
            <p className="mt-3 text-sm font-medium">{tools}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{check}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
