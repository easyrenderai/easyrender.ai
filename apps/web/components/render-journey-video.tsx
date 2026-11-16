'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

/** Offline illustrative clip. Opening it never runs a render or a third-party integration. */
export function RenderJourneyVideo({ journey }: { journey: 'web' | 'shop' | 'design' }) {
  const t = useTranslations('Render.nextSteps');
  const locale = useLocale();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let hasStarted = false;
    const stop = () => {
      if (motion.matches || document.hidden) video.pause();
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) video.pause();
        else if (!hasStarted && !motion.matches && !document.hidden) {
          hasStarted = true;
          void video.play().catch(() => {
            // Browser policy may require a click; native controls remain available.
          });
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(video);
    motion.addEventListener('change', stop);
    document.addEventListener('visibilitychange', stop);
    return () => {
      observer.disconnect();
      motion.removeEventListener('change', stop);
      document.removeEventListener('visibilitychange', stop);
      video.pause();
    };
  }, []);

  return (
    <figure className="space-y-3">
      <video
        ref={videoRef}
        src={`/motion/${journey}.mp4`}
        poster={`/motion/${journey}.jpg`}
        width={1200}
        height={900}
        controls
        muted
        playsInline
        preload="none"
        aria-label={t(`${journey}.title`)}
        className="block aspect-[4/3] w-full rounded-lg border bg-background"
        onError={() => setHasError(true)}
      >
        <track
          kind="captions"
          src={`/motion/${journey}.${locale}.vtt`}
          srcLang={locale}
          label={t('video.captions')}
          default
        />
      </video>
      <figcaption className="text-xs leading-relaxed text-muted-foreground">
        {hasError ? t('video.error') : t('video.illustration')}
      </figcaption>
    </figure>
  );
}
