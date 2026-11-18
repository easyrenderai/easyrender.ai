import { getTranslations } from 'next-intl/server';
import { FileConverter } from '@/components/viewer/file-converter';
import { ToolIntro, ToolPage } from '@/components/viewer/tool-page';
import type { Locale } from '@/i18n/config';
import { ROUTES } from '@/lib/seo/routes';
import { EXPORT_FORMATS } from '@/lib/viewer/formats';

const FAQ_KEYS = ['formats', 'fbx', 'textures', 'privacy', 'free'] as const;
const STEP_KEYS = ['drop', 'choose', 'download'] as const;

/** The questions on the page and in its FAQPage structured data: one source for both. */
export async function converterFaqItems(locale: Locale) {
  const t = await getTranslations({ locale, namespace: 'Converter.faq' });
  return FAQ_KEYS.map((key) => ({
    question: t(`items.${key}.q`),
    answer: t(`items.${key}.a`),
  }));
}

/** The free 3D converter of one language: the same stage as the viewer, read as a converter. */
export async function ConverterView({ locale }: { locale: Locale }) {
  const [t, faq] = await Promise.all([
    getTranslations({ locale, namespace: 'Converter' }),
    converterFaqItems(locale),
  ]);
  return (
    <ToolPage
      copy={{
        formats: {
          title: t('formats.title'),
          description: t('formats.description'),
          items: EXPORT_FORMATS.map((format) => ({
            name: format.toUpperCase(),
            text: t(`formats.items.${format}`),
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
          href: ROUTES.viewer.paths[locale],
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
      <FileConverter
        intro={
          <ToolIntro eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
        }
        viewerHref={ROUTES.viewer.paths[locale]}
      />
    </ToolPage>
  );
}
