import { useSyncExternalStore } from 'react';

// What this screen can do for AR. The server cannot know, so `unknown` is what the first render
// shows; the real value follows at once on the client.
//   desktop     a computer: show the QR code that carries the model to a phone
//   phone       a phone or tablet: show the button that opens the phone's own AR
//   ios-no-ar   an iPhone or iPad whose browser cannot open AR Quick Look (an in-app view, say)
export type ArDevice = 'unknown' | 'desktop' | 'phone' | 'ios-no-ar';

export function detectArDevice(
  nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'>,
  hasQuickLook: boolean,
): Exclude<ArDevice, 'unknown'> {
  const ua = nav.userAgent;
  // iPadOS asks for the desktop site by default and reports a Mac, but it has a touch screen.
  const isIos = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
  if (isIos) return hasQuickLook ? 'phone' : 'ios-no-ar';
  if (/Android/.test(ua)) return 'phone';
  return 'desktop';
}

function readArDevice(): ArDevice {
  const hasQuickLook = document.createElement('a').relList?.supports?.('ar') ?? false;
  return detectArDevice(navigator, hasQuickLook);
}

export function useArDevice(): ArDevice {
  return useSyncExternalStore(
    () => () => {},
    readArDevice,
    () => 'unknown',
  );
}
