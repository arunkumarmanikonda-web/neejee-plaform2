import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { getSiteSeoConfig } from '@/lib/site/seo-config';
import { stories } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

const INTERNAL_CMS_SLUGS = new Set(['about', 'about-page', 'home-founder-note']);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteSeoConfig().baseUrl.replace(/\/$/, '');
  const now = new Date();

  const staticPaths = [
    '',
    '/about',
    '/about/select',
    '/about/sustainability',
    '/journal',
    '/lookbook',
    '/sellers',
    '/help/shipping',
    '/help/returns',
    '/help/track',
    '/help/contact',
    '/help/faq',
    '/legal/privacy',
  ];

  const staticRoutes: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : path.startsWith('/help/') || path.startsWith('/legal/') ? 0.5 : 0.7,
  }));

  const staticStoryRoutes: MetadataRoute.Sitemap = stories.map((story) => ({
    url: `${base}/journal/${encodeURIComponent(story.slug)}`,
    lastModified: story.publishedAt ? new Date(story.publishedAt) : now,
    changeFrequency: 'monthly',
    priority: 0.65,
  }));

  let productRoutes: MetadataRoute.Sitemap = [];
  let categoryRoutes: MetadataRoute.Sitemap = [];
  let cmsRoutes: MetadataRoute.Sitemap = [];

  try {
    // Production may run Prisma with a deliberately small serverless pool.
    // Keep these reads sequential so sitemap generation cannot self-contend.
    const products = await prisma.product.findMany({
      where: { status: 'ACTIVE', catalogueExclude: false },
      select: { slug: true, updatedAt: true },
      take: 5000,
    });

    const categories = await prisma.category.findMany({
      where: { active: true, hidden: false },
      select: { slug: true, updatedAt: true },
      take: 5000,
    });

    const cmsPages = await prisma.cmsPage.findMany({
      where: { status: 'PUBLISHED' },
      select: { slug: true, updatedAt: true },
      take: 5000,
    }).catch(() => []);

    productRoutes = products.map((product) => ({
      url: `${base}/products/${encodeURIComponent(product.slug)}`,
      lastModified: product.updatedAt || now,
      changeFrequency: 'weekly',
      priority: 0.9,
    }));

    categoryRoutes = categories.map((category) => ({
      url: `${base}/categories/${encodeURIComponent(category.slug)}`,
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
  for (const entry of [...staticRoutes, ...staticStoryRoutes, ...productRoutes, ...categoryRoutes, ...cmsRoutes]) unique.set(entry.url, entry);
  return Array.from(unique.values());
}
