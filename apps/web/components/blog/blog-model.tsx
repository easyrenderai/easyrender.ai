'use client';

import { Rotate3d } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { useMediaQuery } from '@/components/app-shell/shell-context';
import { ModelViewer } from '@/components/model-viewer';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Props = {
  src: string;
  alt: string;
  poster: { src: string; width: number; height: number };
  orbit: string;
  hint: string;
};

// A real GLB in a guide. The poster, a still of the same model, is rendered on the server, so the
// HTML already holds the picture and its alt text. The viewer loads when the box nears the
// viewport and takes over once the model is drawn. The square box reserves the space, so the page
// never moves. Zoom stays off, so scrolling past on a phone never gets caught by the model.
export function BlogModel({ src, alt, poster, orbit, hint }: Props) {
  const [isLoaded, setIsLoaded] = useState(false);
  const isStill = useMediaQuery('(prefers-reduced-motion: reduce)');

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-lg border bg-muted">
      <Image
        src={poster.src}
        alt={alt}
        width={poster.width}
        height={poster.height}
        sizes="(min-width: 768px) 720px, 100vw"
        aria-hidden={isLoaded || undefined}
        className={cn(
          'absolute inset-0 size-full object-contain transition-opacity duration-200 motion-reduce:transition-none',
          isLoaded && 'opacity-0',
        )}
      />
      <ModelViewer
        src={src}
        alt={alt}
        interactive
        zoom={false}
        cameraOrbit={orbit}
        autoRotate={!isStill}
        onLoad={() => setIsLoaded(true)}
        className="absolute inset-0"
      />
      {isLoaded && (
        <Badge variant="secondary" className="pointer-events-none absolute bottom-3 left-3">
          <Rotate3d />
          {hint}
        </Badge>
      )}
    </div>
  );
}
