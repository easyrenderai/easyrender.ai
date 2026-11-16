export type MetalKind = 'neutral' | 'brass' | 'copper';
export type MaterialDecision = {
  kind: MetalKind | 'dielectric' | 'unknown';
  isBrushed: boolean;
  reason: string;
};

// Match whole words, including Spanish hints already accepted by the sheet pipeline.
const metal =
  /\b(steel|stainless|iron|chrome|aluminium|aluminum|metal|acero|inox|hierro|cromo|aluminio)\b/i;
const brass = /\b(brass|lat[oó]n)\b/i;
const copper = /\b(copper|cobre|bronze|bronce)\b/i;
const dielectric =
  /\b(plastic|pl[aá]stico|rubber|goma|fabric|cloth|leather|wood|oak|walnut|stone|ceramic|glass|painted|powder.coated|oxidized|oxidised)\b/i;

export function detectMaterial(label: string, context = ''): MaterialDecision {
  const isBrushed = /\b(brushed|satin|cepillado)\b/i.test(`${label} ${context}`);
  const decision = (raw: string): MaterialDecision | null => {
    const text = raw.replace(/_/g, ' ');
    if (dielectric.test(text) && !(metal.test(text) || brass.test(text) || copper.test(text)))
      return {
        kind: 'dielectric',
        isBrushed: false,
        reason: 'Explicit dielectric or coated finish',
      };
    if (
      /\b(non.metal|not (?:metal|steel|brass|copper|iron)|no metal|painted|powder.coated|oxidized|oxidised)\b/i.test(
        text,
      )
    )
      return { kind: 'dielectric', isBrushed: false, reason: 'Coating or explicit non-metal hint' };
    if (brass.test(text))
      return { kind: 'brass', isBrushed, reason: 'Brass hint; source-supported warm texels only' };
    if (copper.test(text))
      return {
        kind: 'copper',
        isBrushed,
        reason: 'Copper/bronze hint; source-supported warm texels only',
      };
    if (metal.test(text))
      return {
        kind: 'neutral',
        isBrushed,
        reason: 'Metal hint; source-supported neutral texels only',
      };
    return null;
  };
  return (
    decision(label) ??
    decision(context) ?? {
      kind: 'unknown',
      isBrushed: false,
      reason: 'No reliable material label; colour/specularity alone is ambiguous',
    }
  );
}

export function isMetalColor(
  rgb: readonly number[] | Uint8Array,
  kind: MaterialDecision['kind'],
): boolean {
  const [r, g, b] = rgb;
  // Dark glossy plastic never becomes metal merely because it sits beside a steel region.
  if (Math.max(r, g, b) < 75) return false;
  if (kind === 'neutral') return Math.max(r, g, b) - Math.min(r, g, b) < 25;
  if (kind === 'brass') return r > 115 && g > 85 && r > b * 1.15 && r < g * 1.45 && g > b * 1.05;
  if (kind === 'copper') return r > 110 && r > g * 1.2 && g > b * 1.08;
  return false;
}
