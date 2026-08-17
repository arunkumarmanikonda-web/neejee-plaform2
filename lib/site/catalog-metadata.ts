import { cache } from 'react';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { getSiteSeoConfig } from '@/lib/site/seo-config';

function cleanDescription(value: string | null | undefined, fallback: string): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return (text || fallback).slice(0, 320);
}

function activePrice(product: {
  sellingPrice: number;
  salePrice: number | null;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
}): number {
  const now = new Date();
  const saleIsLive =
    product.salePrice != null &&
    (!product.saleStartsAt || product.saleStartsAt <= now) &&
    (!product.saleEndsAt || product.saleEndsAt >= now);
  return saleIsLive ? Number(product.salePrice) : Number(product.sellingPrice);
}

export const getProductSeoRecord = cache(async (slug: string) => {
  return prisma.product.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      sku: true,
      name: true,
      poeticLine: true,
      description: true,
      seoTitle: true,
      seoDesc: true,
      images: true,
      status: true,
      catalogueExclude: true,
      sellingPrice: true,
      salePrice: true,
      saleStartsAt: true,
      saleEndsAt: true,
      updatedAt: true,
      variants: { select: { inventory: true } },
      category: { select: { name: true, path: true, slug: true } },
    },
  });
});

export async function buildProductMetadata(slug: string): Promise<Metadata> {
  const [product, seo] = await Promise.all([getProductSeoRecord(slug), Promise.resolve(getSiteSeoConfig())]);
  if (!product) {
    return { title: 'Product not found', robots: { index: false, follow: false } };
  }

  const canonical = `${seo.baseUrl.replace(/\/$/, '')}/products/${encodeURIComponent(product.slug)}`;
  const description = cleanDescription(
    product.seoDesc || product.description || product.poeticLine,
    `${product.name}, personally chosen by NEEJEE.`,
  );
  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  const indexable = product.status === 'ACTIVE' && !product.catalogueExclude;

  return {
    title: product.seoTitle || product.name,
    description,
    alternates: { canonical },
    robots: { index: indexable, follow: indexable },
    openGraph: {
      type: 'website',
      url: canonical,
      title: product.seoTitle || product.name,
      description,
      siteName: seo.siteName,
      images: images.slice(0, 4).map((url) => ({ url, alt: product.name })),
    },
    twitter: {
      card: 'summary_large_image',
      title: product.seoTitle || product.name,
      description,
      images: images[0] ? [images[0]] : undefined,
    },
  };
}

export async function buildProductJsonLd(slug: string): Promise<Record<string, unknown> | null> {
  const product = await getProductSeoRecord(slug);
  if (!product || product.status !== 'ACTIVE' || product.catalogueExclude) return null;

  const seo = getSiteSeoConfig();
  const canonical = `${seo.baseUrl.replace(/\/$/, '')}/products/${encodeURIComponent(product.slug)}`;
  const pricePaise = activePrice(product);
  const inventory = product.variants.reduce((sum, variant) => sum + Math.max(0, variant.inventory || 0), 0);
  const description = cleanDescription(
    product.seoDesc || product.description || product.poeticLine,
    `${product.name}, personally chosen by NEEJEE.`,
  );

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description,
    sku: product.sku || undefined,
    image: Array.isArray(product.images) ? product.images.filter(Boolean) : [],
    category: product.category?.name || undefined,
    brand: { '@type': 'Brand', name: seo.siteName },
    url: canonical,
    offers: {
      '@type': 'Offer',
      url: canonical,
      priceCurrency: 'INR',
      price: (pricePaise / 100).toFixed(2),
      availability: inventory > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  };
}

export const getCategorySeoRecord = cache(async (pathOrSlug: string) => {
  const normalized = String(pathOrSlug || '').replace(/^\/+|\/+$/g, '');
  if (!normalized) return null;
  return prisma.category.findFirst({
    where: {
      OR: [{ path: normalized }, { slug: normalized }],
    },
    select: {
      slug: true,
      name: true,
      path: true,
      image: true,
      description: true,
      seoTitle: true,
      seoDesc: true,
      active: true,
      hidden: true,
      updatedAt: true,
    },
  });
});

export async function buildCategoryMetadata(pathOrSlug: string): Promise<Metadata> {
  const category = await getCategorySeoRecord(pathOrSlug);
  if (!category) {
    return { title: 'Collection not found', robots: { index: false, follow: false } };
  }

  const seo = getSiteSeoConfig();
  const categoryPath = category.path || category.slug;
  const canonical = `${seo.baseUrl.replace(/\/$/, '')}/categories/${categoryPath}`;
  const description = cleanDescription(
    category.seoDesc || category.description,
    `Discover ${category.name}, personally chosen by NEEJEE.`,
  );
  const indexable = category.active && !category.hidden;

  return {
    title: category.seoTitle || category.name,
    description,
    alternates: { canonical },
    robots: { index: indexable, follow: indexable },
    openGraph: {
      type: 'website',
      url: canonical,
      title: category.seoTitle || category.name,
      description,
      siteName: seo.siteName,
      images: category.image ? [{ url: category.image, alt: category.name }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: category.seoTitle || category.name,
      description,
      images: category.image ? [category.image] : undefined,
    },
  };
}
