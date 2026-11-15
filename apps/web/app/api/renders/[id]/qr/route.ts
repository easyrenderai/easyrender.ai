import { config, getRender } from '@easyrender/core';
import QRCode from 'qrcode';
import { resolveActor } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

// An SVG QR code that opens the render's AR page on a phone, for a store to print or show on a
// product page. Anyone who may see the render may fetch it.
export const GET = (request: Request, { params }: RouteContext<'/api/renders/[id]/qr'>) =>
  apiHandle(request, async () => {
    const { id } = await params;
    const render = await getRender(id, await resolveActor(request.headers));
    const svg = await QRCode.toString(`${config.appUrl()}/ar/${render.id}`, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
    });
    return new Response(svg, {
      headers: {
        'content-type': 'image/svg+xml',
        'cache-control': 'public, max-age=86400',
        'access-control-allow-origin': '*',
      },
    });
  });

export const OPTIONS = apiOptions;
