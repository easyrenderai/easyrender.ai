'use client';

import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

/** Loads only the visible card; reduced-motion readers keep the still poster. */
export function PromoVideo({ label, play, pause }: { label: string; play: string; pause: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || hasError) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let isVisible = false;
    let isActive = true;
    const sync = () => {
      if (!isVisible || isPaused || motion.matches || document.hidden) {
        video.pause();
        return;
      }
      if (!video.getAttribute('src')) video.src = '/blog/promo/room-reveal.mp4';
      void video.play().catch(() => {
        // Autoplay can be blocked; leave the poster and a manual play control.
        if (isActive) setIsPlaying(false);
      });
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = Boolean(entry?.isIntersecting);
        sync();
      },
      { threshold: 0.25 },
    );
    observer.observe(video);
    motion.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      isActive = false;
      observer.disconnect();
      motion.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
      video.pause();
    };
  }, [isPaused, hasError]);

  return (
    <div className="relative overflow-hidden" data-promo-video="">
      {/* Silent room demonstration: the hook and action remain readable outside the video. */}
      {/* biome-ignore lint/a11y/useMediaCaption: silent decorative room demonstration; equivalent description is the accessible label */}
      <video
        ref={videoRef}
        width={600}
        height={400}
        poster="/blog/promo/room-reveal.jpg"
        preload="none"
        muted
        loop
        playsInline
        aria-label={label}
        className="block h-auto w-full"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={() => {
          setHasError(true);
          setIsPlaying(false);
        }}
      />
      {!hasError && (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute right-2 bottom-2 size-8 rounded-full motion-reduce:hidden"
          aria-label={isPlaying ? pause : play}
          onClick={() => {
            if (isPlaying) setIsPaused(true);
            else {
              setIsPaused(false);
              const video = videoRef.current;
              if (video) {
                video.src ||= '/blog/promo/room-reveal.mp4';
                void video.play().catch(() => setHasError(true));
              }
            }
          }}
        >
          {isPlaying ? (
            <Pause className="size-3.5" aria-hidden />
          ) : (
            <Play className="size-3.5" aria-hidden />
          )}
        </Button>
      )}
    </div>
  );
}
