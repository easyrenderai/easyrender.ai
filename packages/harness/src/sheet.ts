import sharp from 'sharp';
import { type MaterialProfile, materialRules } from './materials';
import { DEFAULT_SHEET_SETTINGS, type SheetSettings } from './models';
import { cleanNote } from './note';
import { DEFAULT_SKILL, type RenderSkill } from './skills';

// Reading order of the cells, left to right, top to bottom.
export const VIEWS = [
  'front',
  'front_right',
  'right',
  'back_right',
  'back',
  'back_left',
  'left',
  'front_left',
  'top',
] as const;

export const SHEET_PROMPT = `Using the product in the reference photo, create a 3x3 turnaround sheet of this exact object.
Keep the same shape, proportions, materials, colour and every detail. Do not add, remove or redesign any part. Show the full object in every cell, centred, at the same scale, with a small margin.
Every cell is a different camera position: the camera circles the object in 45 degree steps, so each cell shows the surface texture and details from its own side. Never repeat or copy a view.
Row 1: straight-on front view, front-right three-quarter view, right side view.
Row 2: back-right three-quarter view, straight-on back view, back-left three-quarter view.
Row 3: left side view, front-left three-quarter view, top-down view.
Plain pure white background, even soft studio light, no cast shadows. Nine equal square cells with no text, labels, grid lines or borders.`;

// The skill adds category rules, the materials add what each material can physically do, and the
// user's note is appended as guidance; none of them replaces the turnaround instructions.
export function sheetPrompt(
  userPrompt?: string | null,
  skill: RenderSkill = DEFAULT_SKILL,
  template: string = SHEET_PROMPT,
  materials: MaterialProfile[] = [],
): string {
  const note = cleanNote(userPrompt);
  const parts = [
    template,
    `Product guidance: ${skill.guidance}`,
    'Structural consistency: preserve the exact number, placement and thickness of legs, supports and panels in the reference. Empty space between parts must remain empty in every view. Never fill the space under an open-legged table or invent solid side panels, backs, doors or walls on unseen faces. Use orthographic front, back, left and right views at the same elevation and scale; opposite views must describe the same physical structure.',
  ];
  const rules = materialRules(materials);
  if (rules) parts.push(rules);
  if (note) parts.push(`Additional notes about the object: ${note}`);
  return parts.join('\n');
}

export function sheetRequest(
  sourceUrl: string,
  userPrompt?: string | null,
  skill: RenderSkill = DEFAULT_SKILL,
  settings: SheetSettings = DEFAULT_SHEET_SETTINGS,
  template: string = SHEET_PROMPT,
  materials: MaterialProfile[] = [],
) {
  return {
    path: settings.path,
    body: {
      input: {
        ...settings.input,
        prompt: sheetPrompt(userPrompt, skill, template, materials),
        image_input: [sourceUrl],
      },
    },
  };
}

export function sheetOutputUrl(output: unknown): string | null {
  if (typeof output === 'string') return output;
  if (Array.isArray(output) && typeof output[0] === 'string') return output[0];
  return null;
}

// Insets each crop because the model sometimes draws faint lines between cells despite the prompt.
export async function cutCells(sheet: Uint8Array, inset = 8): Promise<Uint8Array[]> {
  const { width = 0, height = 0 } = await sharp(sheet).metadata();
  const cell = Math.floor(Math.min(width, height) / 3);
  if (cell <= inset * 2) throw new Error(`sheet too small to cut: ${width}x${height}`);
  return Promise.all(
    VIEWS.map(async (_view, index) => {
      const buffer = await sharp(sheet)
        .extract({
          left: (index % 3) * cell + inset,
          top: Math.floor(index / 3) * cell + inset,
          width: cell - inset * 2,
          height: cell - inset * 2,
        })
        .png()
        .toBuffer();
      return new Uint8Array(buffer);
    }),
  );
}
