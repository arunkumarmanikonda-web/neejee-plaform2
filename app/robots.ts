import { MetadataRoute } from 'next';
import { getSiteSeoConfig } from '@/lib/site/seo-config';

export default function robots(): MetadataRoute.Robots {
  const seo = getSiteSeoConfig();
  const base = seo.baseUrl.replace(/\/$/, '');

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/api',
          '/account',
          '/cart',
          '/checkout',
          '/payment',
          '/order-confirmation',
          '/orders',
          '/o/',
          '/complete-profile',
          '/recovery/',
          '/seller',
          '/vendor',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
