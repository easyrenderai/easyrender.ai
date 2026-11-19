'use client';

import { useEffect, useEffectEvent, useRef } from 'react';
import { Scope } from '@/lib/studio/scope';
import { WebGLUnavailableError } from '@/lib/webgl';

// Runs `setup` once the element scrolls near the viewport and tears everything down on unmount.
// `setup` loads its 3D code with a dynamic import, so three.js stays out of the first bundle.
// It runs again when `key` changes (the locale, for sections that write text from the 3D code).
// `idle` waits for the browser to go idle after that, for a section that is already on screen at
// load: its 3D then starts after the first paint and hydration instead of competing with them.
export function useSection<T extends HTMLElement>(
  setup: (root: T, scope: Scope) => Promise<void> | void,
  key: string,
  margin = '700px',
  { idle = false }: { idle?: boolean } = {},
) {
  const ref = useRef<T>(null);
  const run = useEffectEvent(setup);

  // use-effect-audit: ignore observes the element with an IntersectionObserver and starts the 3D section, outside React
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the caller's signal to set the section up again
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const scope = new Scope();
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const start = () => {
          if (!scope.alive) return;
          Promise.resolve(run(root, scope)).catch((error) => {
            if (error instanceof WebGLUnavailableError) return;
            console.warn('studio: section failed to start', error);
          });
        };
        if (idle) scope.add(whenIdle(start));
        else start();
      },
      { rootMargin: `${margin} 0px` },
    );
    observer.observe(root);
    scope.add(() => observer.disconnect());
    return () => scope.dispose();
  }, [key, margin, idle]);

  return ref;
}

// Runs `callback` after the page has loaded and the main thread is idle (at most `timeout` ms
// after load); returns the cancel. Waiting for `load` keeps the work behind the first paint, the
// fonts and hydration. Safari has no requestIdleCallback, so it falls back to a short timer.
function whenIdle(callback: () => void, timeout = 2000) {
  let cancel = () => {};
  const schedule = () => {
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(callback, { timeout });
      cancel = () => window.cancelIdleCallback(id);
    } else {
      const id = window.setTimeout(callback, 300);
      cancel = () => window.clearTimeout(id);
    }
  };
  if (document.readyState === 'complete') {
    schedule();
  } else {
    window.addEventListener('load', schedule, { once: true });
    cancel = () => window.removeEventListener('load', schedule);
  }
  return () => cancel();
}
