import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // refresh every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.neejee.com';
  const now = new Date();

  // ───────── Static pages ─────────
  const staticRoutes: MetadataRoute.Sitemap = [
    '', '/about', '/journal', '/lookbook', '/sellers',
    '/ai/mirror', '/ai/space', '/ai/gift',
    '/help/shipping', '/help/returns', '/help/contact', '/help/faq',
    '/legal/privacy', '/legal/terms', '/legal/dpdp',
  ].map(p => ({
    url: base + p,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: p === '' ? 1.0 : 0.7,
  }));

  // ───────── Live data from DB ─────────
  let productRoutes: MetadataRoute.Sitemap = [];
  let categoryRoutes: MetadataRoute.Sitemap = [];
  let cmsRoutes: MetadataRoute.Sitemap = [];

  try {
    const [products, categories, cmsPages] = await Promise.all([
      prisma.product.findMany({
        where: { status: 'ACTIVE' },
        select: { slug: true, updatedAt: true },
        take: 5000,
      }),
      prisma.category.findMany({
        select: { slug: true },
      }),
      prisma.cmsPage.findMany({
        where: { status: 'PUBLISHED' },
        select: { slug: true, updatedAt: true },
      }).catch(() => []),
    ]);

    productRoutes = products.map(p => ({
      url: `${base}/products/${p.slug}`,
      lastModified: p.updatedAt || now,
      changeFrequency: 'weekly',
      priority: 0.9,
    }));

    categoryRoutes = categories.map(c => ({
      url: `${base}/categories/${c.slug}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    }));

    cmsRoutes = cmsPages.map((p: any) => ({
      url: `${base}/p/${p.slug}`,
      lastModified: p.updatedAt || now,
      changeFrequency: 'monthly',
      priority: 0.6,
    }));
  } catch {
    // DB unavailable at build time — return static routes only, never break sitemap
  }

  return [...staticRoutes, ...productRoutes, ...categoryRoutes, ...cmsRoutes];
}
