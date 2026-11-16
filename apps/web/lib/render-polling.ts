import type { RenderView } from '@easyrender/core';

/** Poll serially, recover after connection failures, and abort when the view leaves the stage. */
export function startRenderPolling(
  id: string,
  onUpdate: (render: RenderView) => void,
  onConnectionError: (hasError: boolean) => void,
) {
  let isActive = true;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const poll = async () => {
    try {
      const response = await fetch(`/api/renders/${encodeURIComponent(id)}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('status unavailable');
      const updated: RenderView = await response.json();
      if (isActive) {
        onUpdate(updated);
        onConnectionError(false);
      }
    } catch {
      if (isActive) onConnectionError(true);
    } finally {
      if (isActive) timer = setTimeout(poll, 3000);
    }
  };
  timer = setTimeout(poll, 3000);
  return () => {
    isActive = false;
    clearTimeout(timer);
    controller.abort();
  };
}
