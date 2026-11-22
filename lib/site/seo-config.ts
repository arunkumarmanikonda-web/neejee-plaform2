import type { Metadata } from 'next';

export type SeoFieldKey =
  | 'NEXT_PUBLIC_SITE_NAME'
  | 'NEXT_PUBLIC_CANONICAL_BASE_URL'
  | 'NEXT_PUBLIC_DEFAULT_META_TITLE'
  | 'NEXT_PUBLIC_META_TITLE_TEMPLATE'
  | 'NEXT_PUBLIC_DEFAULT_META_DESCRIPTION'
  | 'NEXT_PUBLIC_META_KEYWORDS'
  | 'NEXT_PUBLIC_OG_TITLE'
  | 'NEXT_PUBLIC_OG_DESCRIPTION'
  | 'NEXT_PUBLIC_OG_IMAGE_URL'
  | 'NEXT_PUBLIC_TWITTER_TITLE'
  | 'NEXT_PUBLIC_TWITTER_DESCRIPTION'
  | 'NEXT_PUBLIC_ROBOTS_INDEX'
  | 'NEXT_PUBLIC_ROBOTS_FOLLOW';

type SeoFieldMeta = {
  label: string;
  helper: string;
  defaultValue: string;
  multiline?: boolean;
  placeholder?: string;
};

const LEGACY_UPLOADED_LOGO =
  'https://xjqehwvxscoktfecbwse.supabase.co/storage/v1/object/public/neejee-media/legal-entity/1781352832764-ig1uzl-01_neejee_primary_logo.png';
const OFFICIAL_SOCIAL_IMAGE = 'https://neejee.com/brand/identity/social-card.png';
const LEGACY_RECONSTRUCTED_SOCIAL_IMAGE = 'https://neejee.com/brand/neejee-og-1200x630.png';
const LEGACY_DEFAULT_SOCIAL_IMAGE_ID = 'photo-1610030469983-98e550d6193c';

export const SEO_FIELD_ORDER: SeoFieldKey[] = [
  'NEXT_PUBLIC_SITE_NAME',
  'NEXT_PUBLIC_CANONICAL_BASE_URL',
  'NEXT_PUBLIC_DEFAULT_META_TITLE',
  'NEXT_PUBLIC_META_TITLE_TEMPLATE',
  'NEXT_PUBLIC_DEFAULT_META_DESCRIPTION',
  'NEXT_PUBLIC_META_KEYWORDS',
  'NEXT_PUBLIC_OG_TITLE',
  'NEXT_PUBLIC_OG_DESCRIPTION',
  'NEXT_PUBLIC_OG_IMAGE_URL',
  'NEXT_PUBLIC_TWITTER_TITLE',
  'NEXT_PUBLIC_TWITTER_DESCRIPTION',
  'NEXT_PUBLIC_ROBOTS_INDEX',
  'NEXT_PUBLIC_ROBOTS_FOLLOW',
];

export const SEO_FIELD_META: Record<SeoFieldKey, SeoFieldMeta> = {
  NEXT_PUBLIC_SITE_NAME: {
    label: 'Site name',
    helper: 'Brand/site label used in metadata and social surfaces.',
    defaultValue: 'NEEJEE',
    placeholder: 'NEEJEE',
  },
  NEXT_PUBLIC_CANONICAL_BASE_URL: {
    label: 'Canonical base URL',
    helper: 'Primary production host for canonical URLs and metadataBase.',
    defaultValue: 'https://neejee.com',
    placeholder: 'https://neejee.com',
  },
  NEXT_PUBLIC_DEFAULT_META_TITLE: {
    label: 'Default meta title',
    helper: 'Fallback root title when a page does not provide its own metadata.',
    defaultValue: 'NEEJEE · FOUND. PERSONAL.',
    placeholder: 'NEEJEE · FOUND. PERSONAL.',
  },
  NEXT_PUBLIC_META_TITLE_TEMPLATE: {
    label: 'Meta title template',
    helper: 'Template used when a page provides its own title.',
    defaultValue: '%s · NEEJEE',
    placeholder: '%s · NEEJEE',
  },
  NEXT_PUBLIC_DEFAULT_META_DESCRIPTION: {
    label: 'Default meta description',
    helper: 'Fallback search description used across the site.',
    defaultValue: "Discover Neejee’s edit of sarees, suits and a few pieces for the home. Found. Personal.",
    multiline: true,
    placeholder: 'Write the default search description',
  },
  NEXT_PUBLIC_META_KEYWORDS: {
    label: 'Meta keywords',
    helper: 'Comma-separated keyword list for the default metadata footprint.',
    defaultValue: 'Indian fashion, sarees, salwar suits, kurta sets, Indian craft, home décor',
    multiline: true,
    placeholder: 'keyword one, keyword two, keyword three',
  },
  NEXT_PUBLIC_OG_TITLE: {
    label: 'Open Graph title',
    helper: 'Default title for social link previews.',
    defaultValue: 'NEEJEE · FOUND. PERSONAL.',
    placeholder: 'NEEJEE · FOUND. PERSONAL.',
  },
  NEXT_PUBLIC_OG_DESCRIPTION: {
    label: 'Open Graph description',
    helper: 'Default Open Graph description for social previews.',
    defaultValue: "Sarees, suits and a few pieces for the home, personally chosen by Neejee.",
    multiline: true,
    placeholder: 'Default OG description',
  },
  NEXT_PUBLIC_OG_IMAGE_URL: {
    label: 'Open Graph image URL',
    helper: 'Absolute image URL for default social preview artwork.',
    defaultValue: OFFICIAL_SOCIAL_IMAGE,
    placeholder: 'https://...',
  },
  NEXT_PUBLIC_TWITTER_TITLE: {
    label: 'Twitter/X title',
    helper: 'Default title for Twitter/X card previews.',
    defaultValue: 'NEEJEE · FOUND. PERSONAL.',
    placeholder: 'NEEJEE · FOUND. PERSONAL.',
  },
  NEXT_PUBLIC_TWITTER_DESCRIPTION: {
    label: 'Twitter/X description',
    helper: 'Default description for Twitter/X previews.',
    defaultValue: "India's finest craft, personally chosen.",
    multiline: true,
    placeholder: 'Default Twitter/X description',
  },
  NEXT_PUBLIC_ROBOTS_INDEX: {
    label: 'Robots index',
    helper: 'Set true to allow indexing by search engines.',
    defaultValue: 'true',
    placeholder: 'true',
  },
  NEXT_PUBLIC_ROBOTS_FOLLOW: {
    label: 'Robots follow',
    helper: 'Set true to allow crawlers to follow links.',
    defaultValue: 'true',
    placeholder: 'true',
  },
};

export type SiteSeoConfig = {
  siteName: string;
  baseUrl: string;
  defaultTitle: string;
  titleTemplate: string;
  defaultDescription: string;
  keywords: string[];
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
  twitterTitle: string;
  twitterDescription: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
};

function readValue(key: SeoFieldKey) {
  const raw = process.env[key];
  return raw && raw.trim() ? raw.trim() : SEO_FIELD_META[key].defaultValue;
}

function canonicalizeBrandLine(value: string) {
  return value
    .replace(/found\s*[.·]\s*personal\.?/gi, 'FOUND. PERSONAL.')
    .replace(/found\s+personal\.?/gi, 'FOUND. PERSONAL.');
}

function removeUnverifiedFairTradeClaim(value: string) {
  return value
    .replace(/,\s*fair[- ]trade\s*\.?/gi, '.')
    .replace(/\s+fair[- ]trade\s*\.?/gi, '.')
    .replace(/\.\.+/g, '.')
    .replace(/\s+\./g, '.')
    .trim();
}

function toBoolean(value: string, fallback: boolean) {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
}

function normalizeKeywords(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeAbsoluteUrl(value: string, fallback: string) {
  try {
    return new URL(value).toString();
  } catch {
    return fallback;
  }
}

function canonicalizeSocialImage(value: string) {
  const normalized = normalizeAbsoluteUrl(value, OFFICIAL_SOCIAL_IMAGE);
  try {
    const url = new URL(normalized);
    if (
      normalized === LEGACY_UPLOADED_LOGO ||
      normalized === LEGACY_RECONSTRUCTED_SOCIAL_IMAGE ||
      (url.hostname === 'neejee.com' && url.pathname === '/brand/neejee-og-1200x630.png') ||
      (url.hostname === 'images.unsplash.com' && url.pathname.includes(LEGACY_DEFAULT_SOCIAL_IMAGE_ID))
    ) {
      return OFFICIAL_SOCIAL_IMAGE;
    }
  } catch {
    return OFFICIAL_SOCIAL_IMAGE;
  }
  return normalized;
}

export function getSiteSeoConfig(): SiteSeoConfig {
  const siteName = readValue('NEXT_PUBLIC_SITE_NAME');
  const baseUrl = normalizeAbsoluteUrl(
    readValue('NEXT_PUBLIC_CANONICAL_BASE_URL'),
    'https://neejee.com',
  );
  const defaultTitle = canonicalizeBrandLine(readValue('NEXT_PUBLIC_DEFAULT_META_TITLE'));
  const titleTemplate = readValue('NEXT_PUBLIC_META_TITLE_TEMPLATE');
  const defaultDescription = removeUnverifiedFairTradeClaim(
    readValue('NEXT_PUBLIC_DEFAULT_META_DESCRIPTION'),
  );
  const keywords = normalizeKeywords(readValue('NEXT_PUBLIC_META_KEYWORDS'));
  const ogTitle = canonicalizeBrandLine(readValue('NEXT_PUBLIC_OG_TITLE'));
  const ogDescription = readValue('NEXT_PUBLIC_OG_DESCRIPTION');
  const ogImageUrl = canonicalizeSocialImage(readValue('NEXT_PUBLIC_OG_IMAGE_URL'));
  const twitterTitle = canonicalizeBrandLine(readValue('NEXT_PUBLIC_TWITTER_TITLE'));
  const twitterDescription = readValue('NEXT_PUBLIC_TWITTER_DESCRIPTION');
  const robotsIndex = toBoolean(readValue('NEXT_PUBLIC_ROBOTS_INDEX'), true);
  const robotsFollow = toBoolean(readValue('NEXT_PUBLIC_ROBOTS_FOLLOW'), true);

  return {
    siteName,
    baseUrl,
    defaultTitle,
    titleTemplate,
    defaultDescription,
    keywords,
    ogTitle,
    ogDescription,
    ogImageUrl,
    twitterTitle,
    twitterDescription,
    robotsIndex,
    robotsFollow,
  };
}

export function getRootMetadata(): Metadata {
  const seo = getSiteSeoConfig();

  return {
    metadataBase: new URL(seo.baseUrl),
    title: {
      default: seo.defaultTitle,
      template: seo.titleTemplate,
    },
    description: seo.defaultDescription,
    keywords: seo.keywords,
    openGraph: {
      title: seo.ogTitle,
      description: seo.ogDescription,
      url: seo.baseUrl,
      siteName: seo.siteName,
      locale: 'en_IN',
      type: 'website',
      images: [
        {
          url: seo.ogImageUrl,
          ...(seo.ogImageUrl === OFFICIAL_SOCIAL_IMAGE ? { width: 1200, height: 630 } : {}),
          alt: `${seo.siteName} — FOUND. PERSONAL.`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.twitterTitle,
      description: seo.twitterDescription,
      images: [seo.ogImageUrl],
    },
    icons: {
      icon: [{ url: '/brand/identity/favicon.svg', type: 'image/svg+xml', sizes: 'any' }],
      apple: [{ url: '/brand/identity/apple-touch-icon.png', type: 'image/png', sizes: '180x180' }],
    },
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: seo.siteName,
    },
    robots: {
      index: seo.robotsIndex,
      follow: seo.robotsFollow,
    },
  };
}
