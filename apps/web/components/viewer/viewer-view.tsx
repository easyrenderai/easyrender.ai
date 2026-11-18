import { getTranslations } from 'next-intl/server';
import { FileViewer } from '@/components/viewer/file-viewer';
import { ToolIntro, ToolPage } from '@/components/viewer/tool-page';
import type { Locale } from '@/i18n/config';
import { ROUTES } from '@/lib/seo/routes';
import { VIEWER_FORMATS } from '@/lib/viewer/formats';

const FAQ_KEYS = ['formats', 'privacy', 'textures', 'glb', 'free'] as const;
const STEP_KEYS = ['drop', 'inspect', 'share'] as const;
// The message key of each format: a key cannot start with a digit in a typed lookup.
const FORMAT_KEYS = {
  glb: 'glb',
  gltf: 'gltf',
  obj: 'obj',
  fbx: 'fbx',
  stl: 'stl',
  ply: 'ply',
  '3mf': 'threeMf',
  dae: 'dae',
  usdz: 'usdz',
  '3ds': 'threeDs',
} as const;

/** The questions on the page and in its FAQPage structured data: one source for both. */
export async function viewerFaqItems(locale: Locale) {
  const t = await getTranslations({ locale, namespace: 'Viewer.faq' });
  return FAQ_KEYS.map((key) => ({
    question: t(`items.${key}.q`),
    answer: t(`items.${key}.a`),
  }));
}

/** The free 3D viewer of one language: the tool first, then what it opens and how. */
export async function ViewerView({ locale }: { locale: Locale }) {
  const [t, faq] = await Promise.all([
    getTranslations({ locale, namespace: 'Viewer' }),
    viewerFaqItems(locale),
  ]);
  return (
    <ToolPage
      copy={{
        formats: {
          title: t('formats.title'),
          description: t('formats.description'),
          items: VIEWER_FORMATS.map((format) => ({
            name: format.toUpperCase(),
            text: t(`formats.items.${FORMAT_KEYS[format]}`),
          })),
        },
        steps: {
          title: t('steps.title'),
          items: STEP_KEYS.map((key) => ({
            title: t(`steps.${key}.title`),
            body: t(`steps.${key}.body`),
          })),
        },
        other: {
          body: t('other.body'),
          action: t('other.action'),
          href: ROUTES.converter.paths[locale],
        },
        cta: {
          title: t('cta.title'),
          body: t('cta.body'),
          action: t('cta.action'),
          href: `${ROUTES.home.paths[locale]}#try`,
        },
        faq: { title: t('faq.title'), items: faq },
      }}
    >
      <FileViewer
        intro={
          <ToolIntro eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
        }
      />
    </ToolPage>
  );
}
