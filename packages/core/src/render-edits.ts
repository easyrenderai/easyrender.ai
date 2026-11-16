import { db, type RenderEdit } from '@easyrender/db';
import { reportError } from './report';

// The steps that go in a render's history. Each is written when the step starts.
export const RENDER_EDIT_KINDS = ['sheet', 'sheet_redraw', 'build', 'material'] as const;
export type RenderEditKind = (typeof RENDER_EDIT_KINDS)[number];

export type RenderEditView = {
  id: string;
  kind: RenderEditKind;
  note: string | null;
  credits: number;
  createdAt: string;
};

const isKind = (value: string): value is RenderEditKind =>
  (RENDER_EDIT_KINDS as readonly string[]).includes(value);

export function toEditView(edit: RenderEdit): RenderEditView | null {
  // A kind this build does not know (written by a newer deploy) is left out, never shown wrong.
  if (!isKind(edit.kind)) return null;
  return {
    id: edit.id,
    kind: edit.kind,
    note: edit.note,
    credits: edit.credits,
    createdAt: edit.createdAt.toISOString(),
  };
}

// Writes one history row. The history is a record of what already happened, so a failure to write
// it is reported and never fails the paid step it describes.
export async function recordEdit(
  renderId: string,
  kind: RenderEditKind,
  input: { note?: string | null; credits?: number } = {},
): Promise<void> {
  try {
    await db().renderEdit.create({
      data: { renderId, kind, note: input.note ?? null, credits: input.credits ?? 0 },
    });
  } catch (error) {
    reportError(error, { where: 'recordEdit', renderId, kind });
  }
}
