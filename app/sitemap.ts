import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { getSiteSeoConfig } from '@/lib/site/seo-config';

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
    '/sellers',
    '/help/shipping',
    '/help/returns',
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

  let productRoutes: MetadataRoute.Sitemap = [];
  let categoryRoutes: MetadataRoute.Sitemap = [];
  let cmsRoutes: MetadataRoute.Sitemap = [];
  let editorialLandingRoutes: MetadataRoute.Sitemap = [];

  try {
    const products = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        catalogueExclude: false,
        OR: [
          { catalogueStockVisibility: { in: ['SHOW_ALL', 'HIDE_STOCK'] } },
          {
            AND: [
              { catalogueStockVisibility: 'IN_STOCK_ONLY' },
              { variants: { some: { inventory: { gt: 0 } } } },
            ],
          },
        ],
      },
      select: {
        slug: true,
        updatedAt: true,
        category: { select: { path: true } },
      },
      take: 5000,
    });

    const categories = await prisma.category.findMany({
      where: { active: true, hidden: false },
      select: { slug: true, path: true, updatedAt: true },
      take: 5000,
    });

    const cmsPages = await prisma.cmsPage.findMany({
      where: { status: 'PUBLISHED' },
      select: { slug: true, pageType: true, updatedAt: true, publishedAt: true },
      take: 5000,
    }).catch(() => []);

    productRoutes = products.map((product) => ({
      url: `${base}/products/${encodeURIComponent(product.slug)}`,
      lastModified: product.updatedAt || now,
      changeFrequency: 'weekly',
      priority: 0.9,
    }));

    const visibleCategoryPaths = new Set<string>();
    for (const product of products) {
      const parts = String(product.category?.path || '')
        .split('/')
        .map((part) => part.trim())
        .filter(Boolean);
      for (let depth = 1; depth <= parts.length; depth += 1) {
        visibleCategoryPaths.add(parts.slice(0, depth).join('/'));
      }
    }

    categoryRoutes = categories
      .filter((category) => !!category.path && visibleCategoryPaths.has(category.path))
      .map((category) => ({
        url: `${base}/categories/${encodeURIComponent(category.slug)}`,
        lastModified: category.updatedAt || now,
        changeFrequency: 'weekly',
        priority: 0.8,
      }));

    const landingSpecs = [
      { pageType: 'journal', path: '/journal', priority: 0.7 as const },
      { pageType: 'lookbook', path: '/lookbook', priority: 0.7 as const },
    ];

    editorialLandingRoutes = landingSpecs.flatMap((spec) => {
      const publishedPages = cmsPages.filter((page) => page.pageType === spec.pageType);
      if (publishedPages.length === 0) return [];
      const newestUpdate = publishedPages.reduce<Date>((latest, page) => {
        const candidate = page.publishedAt || page.updatedAt || now;
        return candidate > latest ? candidate : latest;
      }, new Date(0));
      return [{
        url: `${base}${spec.path}`,
        lastModified: newestUpdate,
        changeFrequency: 'weekly' as const,
        priority: spec.priority,
      }];
    });

    cmsRoutes = cmsPages
      .filter((page) => !INTERNAL_CMS_SLUGS.has(page.slug))
      .map((page) => ({
        url: `${base}/p/${encodeURIComponent(page.slug)}`,
        lastModified: page.publishedAt || page.updatedAt || now,
        changeFrequency: 'monthly',
        priority: page.pageType === 'journal' || page.pageType === 'lookbook' ? 0.65 : 0.6,
      }));
  } catch (error: any) {
    console.warn('[sitemap] catalogue query failed:', error?.message);
  }

  const unique = new Map<string, MetadataRoute.Sitemap[number]>();
  for (const entry of [...staticRoutes, ...editorialLandingRoutes, ...productRoutes, ...categoryRoutes, ...cmsRoutes]) {
    unique.set(entry.url, entry);
  }
  return Array.from(unique.values());
}
