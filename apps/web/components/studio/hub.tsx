'use client';

import { Code2, Download, Search, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SiteLink } from '@/components/site-link';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/config';
import { MODEL_DESTINATIONS } from '@/lib/model-destinations';
import { ROUTES } from '@/lib/seo/routes';
import {
  CATALOG,
  CATEGORIES,
  type CatalogItem,
  type CategoryKey,
  findItem,
  fullFile,
  modelUrl,
  photoUrl,
} from '@/lib/studio/catalog';
import { createFormat, type Format } from '@/lib/studio/format';
import { Scope } from '@/lib/studio/scope';
import type { HubMode, HubPass, mountCard, mountSheet } from '@/lib/studio/sections/hub';
import { TriMark } from './icons';
import './hub.css';

const PASSES: HubPass[] = ['beauty', 'wire', 'normal', 'depth', 'collider'];
const ITEMS = [...CATALOG].sort(
  (a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category),
);

// Case- and accent-insensitive, so "jarron" finds "Jarrón".
const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

type Filter = CategoryKey | 'all';

export function Hub({
  initialCategory,
  initialQuery,
}: {
  initialCategory: CategoryKey | null;
  initialQuery: string;
}) {
  const t = useTranslations('Hub');
  const catalog = useTranslations('Catalog');
  const locale = useLocale();
  const fmt = useMemo(() => createFormat(locale), [locale]);

  const [filter, setFilter] = useState<Filter>(initialCategory ?? 'all');
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<HubMode>('beauty');
  const [openId, setOpenId] = useState<string | null>(null);

  // What each element can be found by, in the visitor's language.
  const haystack = useMemo(
    () =>
      new Map(
        ITEMS.map((item) => [
          item.id,
          fold(
            [
              catalog(`items.${item.id}.name`),
              catalog(`items.${item.id}.prompt`),
              catalog(`categories.${item.category}`),
              catalog(`materials.${item.material}`),
            ].join(' '),
          ),
        ]),
      ),
    [catalog],
  );
  const needle = fold(query.trim());
  const visible = ITEMS.filter(
    (item) =>
      (filter === 'all' || item.category === filter) &&
      (!needle || haystack.get(item.id)?.includes(needle)),
  );
  const shown = new Set(visible.map((item) => item.id));

  // Keep the filters in the address, so a view can be shared, without a navigation. It is written
  // by the handlers that change a filter, not after the render.
  const writeFilters = (nextFilter: Filter, nextQuery: string) => {
    const url = new URL(window.location.href);
    if (nextFilter === 'all') url.searchParams.delete('category');
    else url.searchParams.set('category', nextFilter);
    if (nextQuery.trim()) url.searchParams.set('q', nextQuery.trim());
    else url.searchParams.delete('q');
    if (url.href !== window.location.href) window.history.replaceState(null, '', url);
  };
  const chooseFilter = (next: Filter) => {
    setFilter(next);
    writeFilters(next, query);
  };
  const changeQuery = (next: string) => {
    setQuery(next);
    writeFilters(filter, next);
  };

  // The open sheet lives in the hash: /hub#lamp. Opening and closing write it; arriving with
  // one, or changing it by hand, opens that sheet.
  const openSheet = (id: string | null) => {
    setOpenId(id);
    const url = new URL(window.location.href);
    url.hash = id ?? '';
    window.history.replaceState(null, '', url);
  };
  // use-effect-audit: ignore subscribes to the window hashchange event and reads the hash on arrival
  useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.slice(1);
      setOpenId(findItem(id) ? id : null);
    };
    if (window.location.hash) fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, []);

  return (
    <>
      <section className="hubhead">
        <div>
          <p className="eyebrow">{t('eyebrow', { count: visible.length })}</p>
          <h1>{t('title')}</h1>
        </div>
        <p className="hubhead__sub">{t('description')}</p>
      </section>

      <div className="hubbar">
        {/* biome-ignore lint/a11y/useSemanticElements: a group of toggle buttons, not a form fieldset */}
        <div className="chips" role="group" aria-label={t('categoryLabel')}>
          <button type="button" aria-pressed={filter === 'all'} onClick={() => chooseFilter('all')}>
            {t('all')}
            <sup>{ITEMS.length}</sup>
          </button>
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              aria-pressed={filter === category}
              onClick={() => chooseFilter(category)}
            >
              {catalog(`categories.${category}`)}
              <sup>{ITEMS.filter((item) => item.category === category).length}</sup>
            </button>
          ))}
        </div>
        <div className="hubbar__tools">
          <label className="search">
            <Search aria-hidden="true" />
            <span className="sr-only">{t('search')}</span>
            <input
              type="search"
              name="q"
              value={query}
              onChange={(event) => changeQuery(event.target.value)}
              placeholder={t('search')}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          {/* biome-ignore lint/a11y/useSemanticElements: a two-way toggle, not a form fieldset */}
          <div className="modes" role="group" aria-label={t('viewLabel')}>
            <button
              type="button"
              aria-pressed={mode === 'beauty'}
              onClick={() => setMode('beauty')}
            >
              {t('render')}
            </button>
            <button type="button" aria-pressed={mode === 'wire'} onClick={() => setMode('wire')}>
              {t('mesh')}
            </button>
          </div>
        </div>
      </div>

      <ul className="hubgrid">
        {ITEMS.map((item) => (
          <HubCard
            key={item.id}
            item={item}
            mode={mode}
            hidden={!shown.has(item.id)}
            fmt={fmt}
            onOpen={() => openSheet(item.id)}
          />
        ))}
      </ul>
      {visible.length === 0 && (
        <p className="hubempty">
          {query.trim()
            ? t('emptyQuery', { query: query.trim() })
            : t('emptyCategory', {
                category: filter === 'all' ? t('all') : catalog(`categories.${filter}`),
              })}
        </p>
      )}

      <HubSheet id={openId} fmt={fmt} onClose={() => openSheet(null)} />
    </>
  );
}

function HubCard({
  item,
  mode,
  hidden,
  fmt,
  onOpen,
}: {
  item: CatalogItem;
  mode: HubMode;
  hidden: boolean;
  fmt: Format;
  onOpen: () => void;
}) {
  const t = useTranslations('Hub');
  const catalog = useTranslations('Catalog');
  const host = useRef<HTMLDivElement>(null);
  const card = useRef<ReturnType<typeof mountCard> | null>(null);
  const wanted = useRef(mode);
  const [ready, setReady] = useState(false);
  const name = catalog(`items.${item.id}.name`);

  // use-effect-audit: ignore mounts the 3D card into its host element and disposes it, a widget outside React
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const scope = new Scope();
    const controller = new AbortController();
    import('@/lib/studio/sections/hub')
      .then((hub) => {
        if (controller.signal.aborted) return;
        card.current = hub.mountCard(element, item.id, scope, () => setReady(true));
        card.current.setMode(wanted.current);
      })
      .catch((error) => console.warn('hub: card failed to start', item.id, error));
    return () => {
      controller.abort();
      scope.dispose();
      card.current = null;
      setReady(false);
    };
  }, [item.id]);

  // use-effect-audit: ignore pushes the mode into the mounted 3D card, a widget outside React
  useEffect(() => {
    wanted.current = mode;
    card.current?.setMode(mode);
  }, [mode]);

  return (
    <li
      className={ready ? 'el is-ready' : 'el'}
      hidden={hidden}
      onPointerEnter={() => card.current?.setHover(true)}
      onPointerLeave={() => card.current?.setHover(false)}
    >
      <button
        className="el__btn"
        type="button"
        aria-label={t('openSheet', { name })}
        onClick={onOpen}
      >
        <div className="el__view">
          <div className="view" ref={host} />
          <span className="tag">{catalog(`categories.${item.category}`)}</span>
          <span className="el__spin" aria-hidden="true">
            {t('viewSheet')}
          </span>
        </div>
        <div className="el__meta">
          <h2 className="el__name">{name}</h2>
          <p className="el__dims">
            {fmt.dims(item)} · {fmt.int(item.lods[0].tris)}
            <TriMark label={t('sheet.triangles')} />
          </p>
        </div>
      </button>
    </li>
  );
}

function HubSheet({ id, fmt, onClose }: { id: string | null; fmt: Format; onClose: () => void }) {
  const t = useTranslations('Hub.sheet');
  const nextT = useTranslations('Hub.usage');
  const stepsT = useTranslations('Render.nextSteps');
  const locale = useLocale() as Locale;
  const catalog = useTranslations('Catalog');
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const closer = useRef<HTMLButtonElement>(null);
  const scope = useRef<Scope | null>(null);
  const sheet = useRef<ReturnType<typeof mountSheet> | null>(null);
  const [pass, setPass] = useState<HubPass>('beauty');
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const item = id ? findItem(id) : null;

  // One inspector for the page; it is built the first time a sheet opens.
  // use-effect-audit: ignore owns the lifetime of the inspector scope that tears down the 3D sheet
  useEffect(() => {
    const created = new Scope();
    scope.current = created;
    return () => {
      created.dispose();
      scope.current = null;
      sheet.current = null;
    };
  }, []);

  // use-effect-audit: ignore syncs the native dialog and the 3D sheet with the open id
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!id) {
      if (element.open) element.close();
      sheet.current?.pause();
      return;
    }
    if (!element.open) element.showModal();
    // Start on the close button rather than inside the viewer.
    closer.current?.focus({ preventScroll: true });
    setPass('beauty');
    setCopy('idle');
    const controller = new AbortController();
    (async () => {
      if (!sheet.current) {
        const hub = await import('@/lib/studio/sections/hub');
        if (controller.signal.aborted || !stage.current || !scope.current?.alive) return;
        sheet.current = hub.mountSheet(stage.current, scope.current);
      }
      await sheet.current.show(id);
    })().catch((error) => console.warn('hub: sheet failed to open', id, error));
    return () => controller.abort();
  }, [id]);

  const choose = (next: HubPass) => {
    setPass(next);
    sheet.current?.setPass(next).catch(() => {});
  };

  const copyEmbed = async () => {
    if (!item) return;
    const src = new URL(modelUrl(fullFile(item).file), window.location.href).href;
    const name = catalog(`items.${item.id}.name`);
    const code = [
      '<script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js"></script>',
      `<model-viewer src="${src}" alt="${name}" ar camera-controls auto-rotate style="width:100%;height:480px"></model-viewer>`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(code);
      setCopy('copied');
    } catch {
      setCopy('failed');
    }
    setTimeout(() => setCopy('idle'), 1800);
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape already closes a modal dialog; the click is for the backdrop
    <dialog
      ref={dialog}
      className="sheet"
      aria-labelledby="hub-sheet-name"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <div className="sheet__in">
        <div
          ref={stage}
          className="sheet__stage"
          data-pass={pass}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: the viewer is turned and zoomed from the keyboard
          tabIndex={0}
          role="application"
          aria-label={t('viewer')}
        >
          <div className="view" data-er="view" />
          {/* biome-ignore lint/a11y/useSemanticElements: a group of toggle buttons, not a form fieldset */}
          <div className="sheet__passes" role="group" aria-label={t('passLabel')}>
            {PASSES.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={pass === key}
                onClick={() => choose(key)}
              >
                {t(`passes.${key}`)}
              </button>
            ))}
          </div>
          <p className="sheet__hint">{t('hint')}</p>
        </div>

        <div className="sheet__side">
          <button
            ref={closer}
            className="sheet__close"
            type="button"
            aria-label={t('close')}
            onClick={() => dialog.current?.close()}
          >
            <X />
          </button>
          {item && (
            <>
              <p className="eyebrow">{catalog(`categories.${item.category}`)}</p>
              <h2 className="sheet__name" id="hub-sheet-name">
                {catalog(`items.${item.id}.name`)}
              </h2>
              <p className="sheet__prompt">{catalog(`items.${item.id}.prompt`)}</p>

              <details className="my-5 space-y-3 text-sm">
                <summary className="cursor-pointer font-medium">{nextT('title')}</summary>
                <p className="text-muted-foreground">{nextT('body')}</p>
                <ul className="space-y-3">
                  {(['web', 'shop', 'design'] as const).map((key) => (
                    <li key={key}>
                      <p className="font-medium">{stepsT(`${key}.title`)}</p>
                      <p className="mt-1 text-muted-foreground">
                        {stepsT(`${key}.steps.${key === 'shop' ? 'use' : 'prepare'}.body`)}
                      </p>
                      <a
                        href={MODEL_DESTINATIONS[key]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block underline underline-offset-4"
                      >
                        {stepsT(`${key}.action`)}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
              <Button asChild variant="outline" className="mb-4 w-full whitespace-normal">
                <SiteLink href={`${ROUTES.home.paths[locale]}#try`}>{nextT('create')}</SiteLink>
              </Button>
              <dl className="spec">
                <div>
                  <dt>{t('size')}</dt>
                  <dd>
                    {fmt.dims(item)}
                    <small>{t('sizeNote')}</small>
                  </dd>
                </div>
                <div>
                  <dt>{t('triangles')}</dt>
                  <dd>
                    {fmt.int(item.lods[0].tris)}
                    <small>
                      {t('lods', {
                        lod1: fmt.int(item.lods[1].tris),
                        lod2: fmt.int(item.lods[2].tris),
                      })}
                    </small>
                  </dd>
                </div>
                <div>
                  <dt>{t('file')}</dt>
                  <dd>
                    {fmt.int(fullFile(item).kb)} KB
                    <small>{t('fileNote')}</small>
                  </dd>
                </div>
                <div>
                  <dt>{t('material')}</dt>
                  <dd>{catalog(`materials.${item.material}`)}</dd>
                </div>
                <div>
                  <dt>{t('mass')}</dt>
                  <dd>{fmt.kg(item.mass)}</dd>
                </div>
                <div>
                  <dt>{t('contact')}</dt>
                  <dd>
                    {t('friction', { value: fmt.fixed(item.friction) })}
                    <small>{t('restitution', { value: fmt.fixed(item.restitution) })}</small>
                  </dd>
                </div>
                <div>
                  <dt>{t('collider')}</dt>
                  <dd>
                    {catalog(`colliders.${item.collider}`)}
                    <small>
                      {item.collider === 'hull'
                        ? t('hullNote', { count: item.hullVerts })
                        : t('primitive')}
                    </small>
                  </dd>
                </div>
                <div>
                  <dt>{t('formats')}</dt>
                  <dd>{item.formats.join(' · ')}</dd>
                </div>
              </dl>

              <figure className="sheet__src">
                {/* biome-ignore lint/performance/noImgElement: small static thumbnail of the input photo */}
                <img src={photoUrl(item.id)} alt="" width={720} height={720} decoding="async" />
                <figcaption>
                  <b>{t('photo')}</b>
                  <span>{t('engine', { engine: catalog(`engines.${item.engine}`) })}</span>
                </figcaption>
              </figure>

              <div className="sheet__actions">
                <a
                  className="btn btn--solid"
                  href={modelUrl(fullFile(item).file)}
                  download={`${item.id}.glb`}
                >
                  <Download />
                  {t('download')}
                </a>
                <button className="btn btn--ghost" type="button" onClick={copyEmbed}>
                  <Code2 />
                  <span>
                    {copy === 'copied'
                      ? t('copied')
                      : copy === 'failed'
                        ? t('copyFailed')
                        : t('embed')}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
