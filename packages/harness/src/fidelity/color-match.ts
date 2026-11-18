import sharp from 'sharp';
import { deltaE2000, linear, rgbToLab, srgb } from './color';
import {
  appendTexture,
  assertGeometryUnchanged,
  readDocument,
  textureBytes,
  writeDocument,
} from './glb-document';
import { objectMask, photoPixels } from './images';

// A whole-object colour match for the builds that `correctFidelity` has to skip (it needs a camera
// that lines up with the photo and enough safe texels). TRELLIS tends to bake a texture that is
// darker and flatter than the photo, so when the per-texel pass does nothing, the base-colour
// texture is scaled so its typical colour matches the typical colour of the object in the photo.
// Only the texture changes; the geometry is checked byte for byte. It never invents detail.

export type ColorMatchReport = {
  version: 1;
  status: 'applied' | 'skipped';
  reason: string;
  // Linear-light gain per channel that was applied to the base-colour texture.
  gain?: [number, number, number];
  // CIEDE2000 between the typical model colour and the typical photo colour.
  beforeDeltaE?: number;
  afterDeltaE?: number;
};
export type ColorMatchResult = { bytes: Uint8Array; report: ColorMatchReport };

// Below this the model already looks like the photo. Above the gain limits the difference is
// more likely a lighting or masking problem than a wrong texture, so nothing is changed.
const MIN_DELTA_E = 6;
const MIN_GAIN = 0.6;
const MAX_GAIN = 2;
const MIN_MASK_FRACTION = 0.05;
const MAX_MASK_FRACTION = 0.95;
// How far the colour moves towards the photo: half per channel (hue), half as one brightness gain.
const HUE_SHARE = 0.5;

type Rgb = [number, number, number];
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const luminance = ([r, g, b]: Rgb) => 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = Float64Array.from(values).sort();
  return sorted[Math.floor(sorted.length / 2)];
};
const medianColor = (channels: [number[], number[], number[]]): Rgb => [
  median(channels[0]),
  median(channels[1]),
  median(channels[2]),
];
const toLab = (color: Rgb) => rgbToLab(color.map((c) => Math.round(srgb(c) * 255)));

function skipped(bytes: Uint8Array, reason: string, extra: Partial<ColorMatchReport> = {}) {
  return { bytes, report: { version: 1, status: 'skipped', reason, ...extra } as ColorMatchReport };
}

export async function matchColorToPhoto(
  bytes: Uint8Array,
  photo: Uint8Array,
): Promise<ColorMatchResult> {
  try {
    const image = await photoPixels(photo, 512);
    const mask = objectMask(image);
    const fraction = mask.reduce((sum, v) => sum + v, 0) / mask.length;
    if (fraction < MIN_MASK_FRACTION || fraction > MAX_MASK_FRACTION)
      return skipped(bytes, 'uncertain_photo_mask');
    const photoChannels: [number[], number[], number[]] = [[], [], []];
    for (let p = 0; p < mask.length; p++) {
      if (!mask[p] || image.data[p * 4 + 3] < 128) continue;
      for (let c = 0; c < 3; c++) photoChannels[c].push(linear(image.data[p * 4 + c] / 255));
    }
    if (photoChannels[0].length < 64) return skipped(bytes, 'uncertain_photo_mask');
    const photoColor = medianColor(photoChannels);

    const doc = readDocument(bytes);
    const textureIndexes = new Set<number>();
    for (const material of doc.json.materials ?? []) {
      const texture = material.pbrMetallicRoughness?.baseColorTexture;
      if (texture) textureIndexes.add(texture.index);
    }
    if (!textureIndexes.size) return skipped(bytes, 'no_base_color_texture');

    // Decode once; every texel that is painted (not transparent, not the empty black of an atlas).
    const decoded = new Map<number, { data: Uint8Array; width: number; height: number }>();
    const modelChannels: [number[], number[], number[]] = [[], [], []];
    for (const index of textureIndexes) {
      const { data, info } = await sharp(textureBytes(doc, index), { limitInputPixels: 25_000_000 })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      decoded.set(index, { data, width: info.width, height: info.height });
      // A stride keeps the sample small on large atlases without changing its median.
      const stride = Math.max(1, Math.floor((info.width * info.height) / 250_000));
      for (let p = 0; p < info.width * info.height; p += stride) {
        const o = p * 4;
        if (data[o + 3] < 128 || data[o] + data[o + 1] + data[o + 2] < 30) continue;
        for (let c = 0; c < 3; c++) modelChannels[c].push(linear(data[o + c] / 255));
      }
    }
    if (modelChannels[0].length < 64) return skipped(bytes, 'no_painted_texels');
    const modelColor = medianColor(modelChannels);

    const beforeDeltaE = deltaE2000(toLab(modelColor), toLab(photoColor));
    if (beforeDeltaE < MIN_DELTA_E) return skipped(bytes, 'already_close', { beforeDeltaE });

    const channelGain = modelColor.map((m, i) => photoColor[i] / Math.max(m, 1e-4));
    const overall = luminance(photoColor) / Math.max(luminance(modelColor), 1e-4);
    const gain = channelGain.map((g) =>
      clamp(HUE_SHARE * g + (1 - HUE_SHARE) * overall, MIN_GAIN, MAX_GAIN),
    ) as Rgb;
    if (channelGain.some((g) => g > MAX_GAIN * 1.5 || g < MIN_GAIN / 1.5))
      return skipped(bytes, 'difference_too_large', { beforeDeltaE });

    const candidate = readDocument(bytes);
    const replaced = new Map<number, number>();
    for (const [index, { data, width, height }] of decoded) {
      const out = new Uint8Array(data.length);
      for (let o = 0; o < data.length; o += 4) {
        out[o + 3] = data[o + 3];
        for (let c = 0; c < 3; c++)
          out[o + c] = Math.round(255 * srgb(Math.min(1, linear(data[o + c] / 255) * gain[c])));
      }
      const sampler = candidate.json.textures?.[index].sampler;
      const encoded = await sharp(out, { raw: { width, height, channels: 4 } })
        .png()
        .toBuffer();
      replaced.set(index, appendTexture(candidate, encoded, sampler));
    }
    for (const material of candidate.json.materials ?? []) {
      const texture = material.pbrMetallicRoughness?.baseColorTexture;
      const next = texture && replaced.get(texture.index);
      if (texture && next !== undefined) texture.index = next;
    }
    const output = writeDocument(candidate);
    assertGeometryUnchanged(bytes, output);

    const matched = modelColor.map((m, i) => Math.min(1, m * gain[i])) as Rgb;
    const afterDeltaE = deltaE2000(toLab(matched), toLab(photoColor));
    // The gain is clamped, so check that it really moved the colour towards the photo.
    if (afterDeltaE >= beforeDeltaE) return skipped(bytes, 'no_improvement', { beforeDeltaE });
    return {
      bytes: output,
      report: {
        version: 1,
        status: 'applied',
        reason: 'object_color_matched_to_photo',
        gain: gain.map((g) => Math.round(g * 1000) / 1000) as Rgb,
        beforeDeltaE,
        afterDeltaE,
      },
    };
  } catch {
    // A model without a usable texture or a photo that will not decode keeps its original colours.
    return skipped(bytes, 'color_match_unavailable');
  }
}
