'use client';

import { ArrowRight, Check } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { SiteLink as Link } from '@/components/site-link';
import { itemOf } from '@/lib/studio/catalog';
import { createFormat } from '@/lib/studio/format';
import type { ToolName } from '@/lib/studio/sections/tools';
import { DemoCursor } from './icons';
import { useSection } from './use-section';

const SOFA = itemOf('sofa');
const VASE = itemOf('clay-vase');
const FORMATS = ['glb', 'usdz'] as const;
const VIEW_TOOLS: ToolName[] = [
  'topology',
  'material',
  'scale',
  'collider',
  'light',
  'uv',
  'export',
];

// The spec sheet, live: eight tiles, each a viewport with the control that drives it.
export function StudioTools() {
  const t = useTranslations('Studio.tools');
  const locale = useLocale();
  const fmt = createFormat(locale);

  const ref = useSection<HTMLDivElement>(async (grid, scope) => {
    const [tools, physics] = await Promise.all([
      import('@/lib/studio/sections/tools'),
      import('@/lib/studio/sections/physics'),
    ]);
    if (!scope.alive) return;
    const format = createFormat(locale);
    const tile = (name: string) => grid.querySelector<HTMLElement>(`[data-tool="${name}"]`);
    const report = (name: string) => (error: unknown) =>
      console.warn(`studio: the ${name} tile failed to start`, error);
    const context = {
      scope,
      fmt: format,
      labels: {
        vertices: (count: number) => t('vertexCount', { count: format.int(count) }),
        triangles: (count: number) => t('triangleCount', { count: format.int(count) }),
      },
    };
    for (const name of VIEW_TOOLS) {
      const element = tile(name);
      if (element) tools.initTool(name, element, context).catch(report(name));
    }
    const drop = tile('physics');
    if (drop) {
      physics.initPhysicsTile(drop, { scope, fmt: format }).catch(report('physics'));
    }
  }, locale);

  return (
    <section className="sec" id="spec" aria-labelledby="studio-tools-title">
      <div className="sec__head">
        <p className="statement reveal" id="studio-tools-title">
          <strong>{t('lead')}</strong>
          {t('body')}
        </p>
        <Link className="link reveal" href="/hub">
          {t('link')} <ArrowRight />
        </Link>
      </div>

      <div ref={ref} className="tools" aria-hidden="true">
        <div className="tool" data-tool="topology">
          <div className="view" data-er="view" />
          <span className="tag">{t('topology')}</span>
          <div className="ctl ctl--slider">
            <span className="ctl__label">{t('triangles')}</span>
            <span className="ctl__val" data-er="value">
              {fmt.int(SOFA.lods[0].tris)}
            </span>
            <span className="ctl__track">
              <i data-er="knob">
                <DemoCursor />
              </i>
            </span>
          </div>
        </div>

        <div className="tool" data-tool="material">
          <div className="view" data-er="view" />
          <span className="tag">{t('material')}</span>
          <div className="ctl ctl--rows">
            <div className="ctl__row">
              <span className="ctl__label">{t('roughness')}</span>
              <span className="ctl__track">
                <i data-er="knob-rough">
                  <DemoCursor data-er="cursor" />
                </i>
              </span>
              <span className="ctl__val" data-er="value-rough">
                {fmt.fixed(0.55)}
              </span>
            </div>
            <div className="ctl__row">
              <span className="ctl__label">{t('metalness')}</span>
              <span className="ctl__track">
                <i data-er="knob-metal" />
              </span>
              <span className="ctl__val" data-er="value-metal">
                {fmt.fixed(0)}
              </span>
            </div>
          </div>
        </div>

        <div className="tool" data-tool="scale">
          <div className="view" data-er="view" />
          <span className="tag">{t('scale')}</span>
          <span className="dim" data-er="dim-w" />
          <span className="dim" data-er="dim-h" />
          <span className="dim" data-er="dim-d" />
        </div>

        <div className="tool" data-tool="collider">
          <div className="view" data-er="view" />
          <span className="tag">{t('collider')}</span>
          <div className="ctl ctl--seg" data-er="segments">
            <span data-er="option">{t('box')}</span>
            <span data-er="option" className="is-on">
              {t('hull')}
            </span>
            <span data-er="option">{t('mesh')}</span>
            <DemoCursor data-er="cursor" />
          </div>
          <span className="ctl ctl--pill" data-er="value" />
        </div>

        <div className="tool" data-tool="physics">
          <div className="view" data-er="view" />
          <span className="tag">{t('physics')}</span>
          <dl className="ctl ctl--list">
            <div>
              <dt>{t('friction')}</dt>
              <dd data-er="friction">{fmt.fixed(VASE.friction)}</dd>
            </div>
            <div>
              <dt>{t('restitution')}</dt>
              <dd data-er="restitution">{fmt.fixed(VASE.restitution)}</dd>
            </div>
          </dl>
        </div>

        <div className="tool" data-tool="light">
          <div className="view" data-er="view" />
          <span className="tag">{t('light')}</span>
          <div className="ctl ctl--slider ctl--kelvin">
            <span className="ctl__label">{t('temperature')}</span>
            <span className="ctl__val" data-er="value">
              2700 K
            </span>
            <span className="ctl__track">
              <i data-er="knob">
                <DemoCursor />
              </i>
            </span>
          </div>
        </div>

        <div className="tool" data-tool="uv">
          <canvas className="uv" data-er="uv" width={640} height={640} />
          <span className="tag">{t('uv')}</span>
          <span className="ctl ctl--pill" data-er="value">
            1024 × 1024 px · WebP
          </span>
        </div>

        <div className="tool" data-tool="export">
          <div className="view" data-er="view" />
          <span className="tag">{t('export')}</span>
          <ul className="ctl ctl--files">
            {FORMATS.map((format) => (
              <li key={format} data-er="file">
                <b>.{format}</b>
                <span>{t(`formats.${format}`)}</span>
                <Check />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
