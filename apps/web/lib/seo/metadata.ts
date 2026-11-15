import type { Metadata } from 'next';
import { type Locale, OG_LOCALE } from '@/i18n/config';
import { hreflangFor } from './routes';
import { absoluteUrl, OG_IMAGE, OG_IMAGE_SIZE, SITE_NAME } from './site';

// One place that builds the head of every marketing page: a self-referencing absolute canonical,
// the hreflang block of its group, and Open Graph and Twitter cards that match the page rather
// than the site. Product and app pages go through noindexMetadata instead.

export type PageMetadataOptions = {
  locale: Locale;
  /** Canonical path of this page, site-relative. */
  path: string;
  title: string;
  description: string;
  /** Live equivalents keyed by locale. Only pass paths that answer 200. */
  alternates?: Partial<Record<Locale, string>>;
  type?: 'website' | 'article';
  image?: string;
  /** The real size of `image`, when it is not the default Open Graph image. */
  imageSize?: { width: number; height: number };
  publishedTime?: string;
  modifiedTime?: string;
};

export function pageMetadata({
  locale,
  path,
  title,
  description,
  alternates,
  type = 'website',
  image = OG_IMAGE,
  imageSize,
  publishedTime,
  modifiedTime,
}: PageMetadataOptions): Metadata {
  const url = absoluteUrl(path);
  const languages = alternates ? hreflangFor(alternates) : undefined;
  return {
    title,
    description,
    robots: { index: true, follow: true, 'max-image-preview': 'large' },
    alternates: { canonical: url, ...(languages ? { languages } : {}) },
    openGraph: {
      type,
      url,
      siteName: SITE_NAME,
      locale: OG_LOCALE[locale],
      title,
      description,
      images: [
        {
          url: absoluteUrl(image),
          alt: title,
          ...(image === OG_IMAGE ? OG_IMAGE_SIZE : (imageSize ?? {})),
        },
      ],
      ...(type === 'article' ? { publishedTime, modifiedTime } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [absoluteUrl(image)],
    },
  };
}

/**
 * Head for a page that must stay out of the index: product surfaces, auth and ad landings. No
 * canonical, no hreflang, no social card — nothing that invites a crawler to treat it as content.
 */
export function noindexMetadata(title: string, description?: string): Metadata {
  return {
    title,
    ...(description ? { description } : {}),
    robots: { index: false, follow: true },
  };
}
