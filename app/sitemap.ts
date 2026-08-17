import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { getSiteSeoConfig } from '@/lib/site/seo-config';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

const INTERNAL_CMS_SLUGS = new Set([
  'about',
  'about-page',
  'home-founder-note',
]);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteSeoConfig().baseUrl.replace(/\/$/, '');
  const now = new Date();

  // Only routes confirmed as genuine public/indexable pages belong here.
  // Legal drafts that do not exist yet must never be advertised to crawlers.
  const staticRoutes: MetadataRoute.Sitemap = [
    '',
    '/about',
    '/journal',
    '/lookbook',
    '/sellers',
    '/help/shipping',
    '/help/returns',
    '/help/contact',
    '/help/faq',
    '/legal/privacy',
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : 0.7,
  }));

  let productRoutes: MetadataRoute.Sitemap = [];
  let categoryRoutes: MetadataRoute.Sitemap = [];
  let cmsRoutes: MetadataRoute.Sitemap = [];

  try {
    const [products, categories, cmsPages] = await Promise.all([
      prisma.product.findMany({
        where: { status: 'ACTIVE', catalogueExclude: false },
        select: { slug: true, updatedAt: true },
        take: 5000,
      }),
      prisma.category.findMany({
        where: { active: true, hidden: false },
        select: { slug: true, path: true, updatedAt: true },
        take: 5000,
      }),
      prisma.cmsPage.findMany({
        where: { status: 'PUBLISHED' },
        select: { slug: true, updatedAt: true },
        take: 5000,
      }).catch(() => []),
    ]);

    productRoutes = products.map((product) => ({
      url: `${base}/products/${encodeURIComponent(product.slug)}`,
      lastModified: product.updatedAt || now,
      changeFrequency: 'weekly',
      priority: 0.9,
    }));

    categoryRoutes = categories.map((category) => ({
      url: `${base}/categories/${category.path || category.slug}`,
      lastModified: category.updatedAt || now,
      changeFrequency: 'weekly',
      priority: 0.8,
    }));

    cmsRoutes = cmsPages
      .filter((page) => !INTERNAL_CMS_SLUGS.has(page.slug))
      .map((page) => ({
        url: `${base}/p/${encodeURIComponent(page.slug)}`,
        lastModified: page.updatedAt || now,
        changeFrequency: 'monthly',
        priority: 0.6,
      }));
  } catch (error: any) {
    console.warn('[sitemap] catalogue query failed:', error?.message);
  }

  const unique = new Map<string, MetadataRoute.Sitemap[number]>();
  for (const entry of [...staticRoutes, ...productRoutes, ...categoryRoutes, ...cmsRoutes]) {
    unique.set(entry.url, entry);
  }
  return Array.from(unique.values());
}
