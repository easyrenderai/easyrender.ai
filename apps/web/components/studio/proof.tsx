import { getTranslations } from 'next-intl/server';
import { SiteLink as Link } from '@/components/site-link';

// Formats the models ship in, and tools that open them.
const WORKS_WITH = ['GLB', 'USDZ', 'Blender', 'SketchUp', 'three.js', 'Shopify', 'ARKit', 'ARCore'];

// The existing compatibility row, shared immediately below each marketing hero.
export async function StudioCompatibility() {
  const t = await getTranslations('Studio.proof');
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users can scroll the reduced-motion row and pause the animated row.
    <section className="marquee" tabIndex={0} aria-label={t('marquee')}>
      <ul className="marquee__row" aria-label={t('marquee')}>
        {WORKS_WITH.map((name) => (
          <li key={name}>{name}</li>
        ))}
        {/* The row is doubled so the loop has no seam. */}
        {WORKS_WITH.map((name) => (
          <li key={`${name}-copy`} aria-hidden="true">
            {name}
          </li>
        ))}
      </ul>
    </section>
  );
}

// The closing bar: one line and one very large button.
export function StudioClosing({
  title,
  label,
  href,
}: {
  title: string;
  label: string;
  href: string;
}) {
  return (
    <section className="cta" aria-labelledby="studio-cta-title">
      <h2 className="cta__title reveal" id="studio-cta-title">
        {title}
      </h2>
      <Link className="cta__bar" href={href}>
        <span>{label}</span>
      </Link>
    </section>
  );
}
