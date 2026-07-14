/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'], // smaller modern formats first
    remotePatterns: [
      { protocol: 'https', hostname: 'www.genspark.ai' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: '*.s3.amazonaws.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      // Supabase storage (AI Mirror rehosted images, seal PNGs, product uploads)
      { protocol: 'https', hostname: '*.supabase.co' },
      // fal.ai CDNs (AI Mirror output, AI seal generation)
      { protocol: 'https', hostname: 'fal.media' },
      { protocol: 'https', hostname: '*.fal.media' },
      { protocol: 'https', hostname: 'cdn.fashn.ai' },
      { protocol: 'https', hostname: 'cdn.staging.fashn.ai' },
      { protocol: 'https', hostname: 'v3.fal.media' },
    ],
    minimumCacheTTL: 60 * 60 * 24, // cache 24h
  },
  experimental: { optimizePackageImports: ['lucide-react'] },
  poweredByHeader: false,
  compress: true,

  async redirects() {
    return [
      {
        source: '/sellers/apply',
        destination: '/sell/apply',
        permanent: true,
      },
    ];
  },

  // Security & cache headers
  async headers() {
    return [
      {
        // PWA icons & static brand assets — cache hard
        source: '/brand/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      {
        // Security baseline for every response
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self), payment=(self)' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;