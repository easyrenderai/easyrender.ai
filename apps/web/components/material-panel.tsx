'use client';

import {
  FINISHES,
  type FinishId,
  type GlbMaterial,
  type MaterialEdit,
} from '@easyrender/harness/glb';
import { Loader2, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { captureBrowser } from '@/lib/analytics/browser';
import { hexToLinear, linearToHex } from '@/lib/color';

type Props = {
  renderId: string;
  // The <model-viewer> element, once its model has loaded. Edits show on it as they are made.
  viewer: HTMLElement | null;
};

type Look = Pick<GlbMaterial, 'baseColor' | 'roughness' | 'metalness'>;
type Loaded = { materials: GlbMaterial[]; edits: MaterialEdit[]; version: number };

// The part of <model-viewer>'s material API this panel uses.
type ViewerMaterial = {
  name: string;
  pbrMetallicRoughness: {
    setBaseColorFactor(color: [number, number, number, number]): void;
    setRoughnessFactor(value: number): void;
    setMetallicFactor(value: number): void;
  };
};
type ViewerElement = HTMLElement & { model?: { materials: ViewerMaterial[] } };

// <model-viewer> lists materials in its own order, which is not always the file's. A name that is
// unique in the file is the safe key; without one the position is the best available.
function viewerMaterial(
  list: ViewerMaterial[],
  materials: GlbMaterial[],
  index: number,
): ViewerMaterial | undefined {
  const name = materials[index]?.name;
  const isUnique = name !== null && materials.filter((m) => m.name === name).length === 1;
  return (isUnique ? list.find((candidate) => candidate.name === name) : undefined) ?? list[index];
}

const lookOf = (material: GlbMaterial, edits: MaterialEdit[]): Look => {
  const edit = edits.find((candidate) => candidate.index === material.index);
  return {
    baseColor: edit?.baseColor ?? material.baseColor,
    roughness: edit?.roughness ?? material.roughness,
    metalness: edit?.metalness ?? material.metalness,
  };
};

const sameColor = (a: Look['baseColor'], b: Look['baseColor']) =>
  a.every((channel, index) => Math.abs(channel - b[index]) < 0.001);

const sameLook = (a: Look, b: Look) =>
  a.roughness === b.roughness && a.metalness === b.metalness && sameColor(a.baseColor, b.baseColor);

// Turns what differs from the generated file into the edits the API stores.
function toEdits(materials: GlbMaterial[], draft: Look[]): MaterialEdit[] {
  const edits: MaterialEdit[] = [];
  for (const material of materials) {
    const look = draft[material.index];
    const edit: MaterialEdit = { index: material.index };
    if (look.roughness !== material.roughness) edit.roughness = look.roughness;
    if (look.metalness !== material.metalness) edit.metalness = look.metalness;
    if (!sameColor(look.baseColor, material.baseColor)) edit.baseColor = look.baseColor;
    if (edit.roughness !== undefined || edit.metalness !== undefined || edit.baseColor)
      edits.push(edit);
  }
  return edits;
}

// Per-material controls for the model in the viewer: a finish, a tint, roughness and metalness.
// The generated file is never changed; what is saved here is applied when the model is served.
export function MaterialPanel({ renderId, viewer }: Props) {
  const t = useTranslations('Render.materials');
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [draft, setDraft] = useState<Look[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'saved'; text: string } | null>(null);

  const adopt = useCallback((data: Loaded) => {
    setLoaded(data);
    setDraft(data.materials.map((material) => lookOf(material, data.edits)));
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(`/api/renders/${renderId}/materials`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        return (await response.json()) as Loaded;
      })
      .then((data) => {
        if (!alive) return;
        adopt(data);
        setStatus('ready');
      })
      .catch(() => alive && setStatus('error'));
    return () => {
      alive = false;
    };
  }, [renderId, adopt]);

  const materials = loaded?.materials ?? [];
  const saved = useMemo(
    () => (loaded ? loaded.materials.map((material) => lookOf(material, loaded.edits)) : []),
    [loaded],
  );
  const isDirty = draft.some((look, index) => saved[index] && !sameLook(look, saved[index]));
  const isEdited = (loaded?.edits.length ?? 0) > 0;

  // Mirror the draft on the live model, so every slider move is visible at once.
  useEffect(() => {
    const model = (viewer as ViewerElement | null)?.model;
    if (!model) return;
    draft.forEach((look, index) => {
      const pbr = viewerMaterial(model.materials, materials, index)?.pbrMetallicRoughness;
      if (!pbr) return;
      pbr.setBaseColorFactor([...look.baseColor, 1]);
      pbr.setRoughnessFactor(look.roughness);
      pbr.setMetallicFactor(look.metalness);
    });
  }, [draft, viewer, materials]);

  function change(index: number, patch: Partial<Look>) {
    setMessage(null);
    setDraft((current) => current.map((look, i) => (i === index ? { ...look, ...patch } : look)));
  }

  async function send(edits: MaterialEdit[]) {
    setSaving(true);
    setMessage(null);
    const response = await fetch(`/api/renders/${renderId}/materials`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ edits }),
    }).catch(() => null);
    if (response?.ok) {
      adopt((await response.json()) as Loaded);
      captureBrowser(edits.length ? 'material_edits_saved' : 'material_edits_reset', {
        material_count: edits.length,
      });
      setMessage({ tone: 'saved', text: edits.length ? t('saved') : t('resetDone') });
      // The history on the render page lists this change.
      router.refresh();
    } else {
      setMessage({ tone: 'error', text: t('saveFailed') });
    }
    setSaving(false);
  }

  return (
    <Card className="gap-4 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-sm">{t('title')}</CardTitle>
        <p className="text-xs text-muted-foreground">{t('hint')}</p>
      </CardHeader>
      <CardContent className="space-y-4 px-4">
        {status === 'loading' && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t('loading')}
          </p>
        )}
        {status === 'error' && (
          <Alert variant="destructive">
            <AlertDescription>{t('loadFailed')}</AlertDescription>
          </Alert>
        )}
        {status === 'ready' && materials.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        )}
        {status === 'ready' &&
          materials.map((material) => {
            const look = draft[material.index];
            if (!look) return null;
            const id = `material-${material.index}`;
            return (
              <div key={material.index} className="space-y-3 rounded-lg border p-3">
                <p className="truncate text-sm font-medium">
                  {material.name ?? t('unnamed', { number: material.index + 1 })}
                </p>
                <div className="flex flex-wrap gap-2">
                  {FINISHES.map((finish) => (
                    <Button
                      key={finish.id}
                      type="button"
                      size="sm"
                      variant={
                        look.roughness === finish.roughness && look.metalness === finish.metalness
                          ? 'secondary'
                          : 'outline'
                      }
                      onClick={() =>
                        change(material.index, {
                          roughness: finish.roughness,
                          metalness: finish.metalness,
                        })
                      }
                    >
                      {t(`finish.${finish.id satisfies FinishId}`)}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2">
                  <Label htmlFor={`${id}-color`}>{t('tint')}</Label>
                  <Input
                    id={`${id}-color`}
                    type="color"
                    className="h-8 w-12 p-1"
                    value={linearToHex(look.baseColor)}
                    onChange={(event) => {
                      const color = hexToLinear(event.target.value);
                      if (color) change(material.index, { baseColor: color });
                    }}
                  />
                </div>
                {(['roughness', 'metalness'] as const).map((field) => (
                  <div key={field} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span id={`${id}-${field}`}>{t(field)}</span>
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">
                        {look[field].toFixed(2)}
                      </span>
                    </div>
                    <Slider
                      aria-label={t(field)}
                      min={0}
                      max={1}
                      step={0.01}
                      value={[look[field]]}
                      onValueChange={([value]) => change(material.index, { [field]: value })}
                    />
                  </div>
                ))}
              </div>
            );
          })}
        {status === 'ready' && materials.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!isDirty || saving}
              onClick={() => loaded && send(toEdits(loaded.materials, draft))}
            >
              {saving && <Loader2 className="animate-spin" />}
              {t('save')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={(!isEdited && !isDirty) || saving}
              onClick={() => send([])}
            >
              <RotateCcw />
              {t('reset')}
            </Button>
          </div>
        )}
        {message && (
          <Alert variant={message.tone === 'error' ? 'destructive' : 'default'}>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
