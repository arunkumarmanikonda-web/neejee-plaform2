import type { ProductReadMedia } from './contracts';

export type MediaReadSourceRow = {
  id: string;
  slug: string;
  images?: unknown;
  cataloguePreferredImage?: string | null;
  catalogueImageApproved?: boolean | null;
  catalogueImageQualityScore?: number | null;
  video?: string | null;
  variants?: Array<{
    id: string;
    images?: unknown;
    inventory?: number | null;
    lowStockThreshold?: number | null;
  }>;
};

export type ResolvedMediaImage = {
  url: string;
  approved: boolean;
  qualityScore: number | null;
  source: 'preferred_override' | 'product_images' | 'variant_images';
  isPrimary: boolean;
};

export type ResolvedMedia = ProductReadMedia;

function parseNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  const text =
    typeof value === 'string'
      ? value.trim()
      : value === null || value === undefined
      ? ''
      : String(value).trim();

  if (!text) return null;

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function asCleanString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item === undefined || item === null) return '';
      return String(item).trim();
    })
    .filter((item): item is string => item.length > 0);
}

export function dedupeMedia(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export function collectProductImages(row: MediaReadSourceRow): string[] {
  return dedupeMedia(toStringArray(row.images));
}

export function collectVariantImages(row: MediaReadSourceRow): string[] {
  const variants = Array.isArray(row.variants) ? row.variants : [];

  return dedupeMedia(
    variants.flatMap((variant) => toStringArray(variant?.images))
  );
}

function buildResolvedImages(
  preferredImage: string | null,
  productImages: string[],
  variantImages: string[],
  approved: boolean,
  qualityScore: number | null,
  primaryImage: string | null
): ResolvedMediaImage[] {
  const items: ResolvedMediaImage[] = [];

  if (preferredImage) {
    items.push({
      url: preferredImage,
      approved,
      qualityScore,
      source: 'preferred_override',
      isPrimary: primaryImage === preferredImage,
    });
  }

  for (const url of productImages) {
    if (items.some((item) => item.url === url)) continue;
    items.push({
      url,
      approved,
      qualityScore,
      source: 'product_images',
      isPrimary: primaryImage === url,
    });
  }

  for (const url of variantImages) {
    if (items.some((item) => item.url === url)) continue;
    items.push({
      url,
      approved,
      qualityScore,
      source: 'variant_images',
      isPrimary: primaryImage === url,
    });
  }

  return items;
}

export function resolveMedia(row: MediaReadSourceRow): ResolvedMedia {
  const preferredImage = asCleanString(row.cataloguePreferredImage);
  const productImages = collectProductImages(row);
  const variantImages = collectVariantImages(row);
  const gallery = dedupeMedia([...productImages, ...variantImages]);

  const imageApproved = !!row.catalogueImageApproved;
  const imageQualityScore = parseNullableNumber(row.catalogueImageQualityScore);
  const video = asCleanString(row.video);

  let primaryImage: string | null = null;
  let selectionMode: ResolvedMedia['selectionMode'] = 'none';
  let selectionSource: ResolvedMedia['selectionSource'] = 'none';
  let fallbackApplied = false;

  if (preferredImage) {
    primaryImage = preferredImage;
    selectionMode = 'preferred_override';
    selectionSource = gallery.includes(preferredImage)
      ? 'gallery'
      : 'external_override';
  }

  if (!primaryImage && productImages.length > 0) {
    primaryImage = productImages[0];
    selectionMode = 'product_gallery';
    selectionSource = 'product_images';
  }

  if (!primaryImage && variantImages.length > 0) {
    primaryImage = variantImages[0];
    selectionMode = 'variant_fallback';
    selectionSource = 'variant_images';
    fallbackApplied = true;
  }

  const approvedGallery = imageApproved ? gallery : [];
  const approvedPrimaryImage =
    imageApproved && primaryImage ? primaryImage : null;

  const resolvedImages = buildResolvedImages(
    preferredImage,
    productImages,
    variantImages,
    imageApproved,
    imageQualityScore,
    primaryImage
  );

  return {
    primaryImage,
    approvedPrimaryImage,
    preferredImage,
    gallery: dedupeMedia(resolvedImages.map((item) => item.url)),
    approvedGallery,
    productImages,
    variantImages,
    video,
    imageApproved,
    imageQualityScore,
    selectionMode,
    selectionSource,
    fallbackApplied,
    hasMedia: resolvedImages.length > 0 || !!primaryImage,
    hasApprovedMedia: approvedGallery.length > 0 || !!approvedPrimaryImage,
  };
}
