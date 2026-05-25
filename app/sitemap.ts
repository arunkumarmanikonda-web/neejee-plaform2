import { MetadataRoute } from 'next';
import { products, categories, stories } from '@/lib/data';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://neejee.com';
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    '', '/about', '/journal', '/cart', '/account', '/ai/mirror', '/ai/space', '/ai/gift', '/sellers',
    '/help/shipping', '/help/returns', '/help/contact', '/help/faq',
    '/legal/privacy', '/legal/terms', '/legal/dpdp',
  ].map(p => ({ url: base + p, lastModified: now, changeFrequency: 'weekly' as const, priority: p === '' ? 1.0 : 0.7 }));

  const productRoutes: MetadataRoute.Sitemap = products.map(p => ({
    url: `${base}/products/${p.slug}`,
    lastModified: now, changeFrequency: 'weekly', priority: 0.9,
  }));
  const categoryRoutes: MetadataRoute.Sitemap = categories.map(c => ({
    url: `${base}/categories/${c.slug}`,
    lastModified: now, changeFrequency: 'weekly', priority: 0.8,
  }));
  const storyRoutes: MetadataRoute.Sitemap = stories.map(s => ({
    url: `${base}/journal/${s.slug}`,
    lastModified: new Date(s.publishedAt), changeFrequency: 'monthly', priority: 0.6,
  }));

  return [...staticRoutes, ...productRoutes, ...categoryRoutes, ...storyRoutes];
}
