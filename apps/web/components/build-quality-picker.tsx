'use client';

import { BUILD_QUALITIES, type BuildQuality } from '@easyrender/harness/pricing';
import { useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

// Low, Medium or High for the 3D build, with what each one costs in all. It never shows a model
// name. `credits` comes from the server (`qualityCredits` of a render) or from the harness pricing.
export function BuildQualityPicker({
  id,
  value,
  onChange,
  credits,
  isDisabled = false,
}: {
  id: string;
  value: BuildQuality;
  onChange: (quality: BuildQuality) => void;
  credits: Record<BuildQuality, number>;
  isDisabled?: boolean;
}) {
  const t = useTranslations('BuildQuality');
  return (
    <div className="space-y-2">
      <Label id={`${id}-label`}>{t('label')}</Label>
      <RadioGroup
        aria-labelledby={`${id}-label`}
        value={value}
        onValueChange={(next) => onChange(next as BuildQuality)}
        disabled={isDisabled}
        className="grid-cols-3"
      >
        {BUILD_QUALITIES.map((quality) => (
          <RadioGroupItem key={quality} value={quality} id={`${id}-${quality}`}>
            <span className="font-medium">{t(quality)}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {t('credits', { credits: credits[quality] })}
            </span>
          </RadioGroupItem>
        ))}
      </RadioGroup>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {t(`${value}Hint`)}
      </p>
    </div>
  );
}
