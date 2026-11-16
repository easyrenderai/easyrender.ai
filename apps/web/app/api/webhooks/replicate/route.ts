import {
  advance,
  advanceUpscale,
  advanceViewSet,
  reportError,
  tickForRender,
} from '@easyrender/core';
import { NextResponse } from 'next/server';

export const maxDuration = 60;

// The payload is not trusted: advance() re-reads the prediction from Replicate itself. A
// `render` id moves a 3D render on; a `views` id moves a product views set on; an `upscale` id moves an enlargement on.
export async function POST(request: Request) {
  const params = new URL(request.url).searchParams;
  const viewSetId = params.get('views');
  if (viewSetId) {
    try {
      await advanceViewSet(viewSetId);
    } catch (error) {
      reportError(error, { viewSetId, stage: 'replicate-webhook' });
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }
  const upscaleId = params.get('upscale');
  if (upscaleId) {
    try {
      await advanceUpscale(upscaleId);
    } catch (error) {
      reportError(error, { upscaleId, stage: 'replicate-webhook' });
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }
  const id = params.get('render');
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    await advance(id);
    // A store's product moves on to its next step as soon as its render does.
    await tickForRender(id);
  } catch (error) {
    reportError(error, { renderId: id, stage: 'replicate-webhook' });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
