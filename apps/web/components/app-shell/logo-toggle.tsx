import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// The logo in the rail doubles as the left drawer toggle. At rest it is the logo; on hover or
// keyboard focus it fades to the collapse (or expand) icon. A pointer that cannot hover shows the
// icon all the time, so the toggle never depends on a hover that does not exist.
const REST =
  'absolute inset-0 grid place-items-center transition-opacity duration-150 motion-reduce:transition-none';

export function LogoToggle({
  isOpen,
  onToggle,
  label,
}: {
  isOpen: boolean;
  onToggle: () => void;
  label: string;
}) {
  const Icon = isOpen ? PanelLeftClose : PanelLeftOpen;
  return (
    <Button
      variant="ghost"
      size="icon"
      className="group relative mb-2 size-10"
      onClick={onToggle}
      aria-label={label}
      title={label}
    >
      <span
        aria-hidden
        className={cn(
          REST,
          'opacity-100 group-hover:opacity-0 group-focus-visible:opacity-0 [@media(hover:none)]:opacity-0',
        )}
      >
        <BrandMark className="size-[1.375rem]" />
      </span>
      <span
        aria-hidden
        className={cn(
          REST,
          'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100',
        )}
      >
        <Icon />
      </span>
    </Button>
  );
}
