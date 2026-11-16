export const SHEET_ISSUES = ['shape', 'parts', 'material'] as const;
export type SheetIssue = (typeof SHEET_ISSUES)[number];
export function correctionNote(instructions: string[], details: string) {
  return [...instructions, details.trim()].filter(Boolean).join('\n');
}
