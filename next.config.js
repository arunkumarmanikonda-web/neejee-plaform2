/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'www.genspark.ai' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: '*.s3.amazonaws.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'fal.media' },
      { protocol: 'https', hostname: '*.fal.media' },
      { protocol: 'https', hostname: 'cdn.fashn.ai' },
      { protocol: 'https', hostname: 'cdn.staging.fashn.ai' },
      { protocol: 'https', hostname: 'v3.fal.media' },
    ],
    minimumCacheTTL: 60 * 60 * 24,
  },
  experimental: { optimizePackageImports: ['lucide-react'] },
  poweredByHeader: false,
  compress: true,

  async redirects() {
    return [
      { source: '/sellers/apply', destination: '/sell/apply', permanent: true },
      // Confirmed legacy/customer-facing aliases. Keep inbound links alive.
      { source: '/stories', destination: '/journal', permanent: true },
      { source: '/legal/shipping', destination: '/help/shipping', permanent: true },
      { source: '/legal/returns', destination: '/help/returns', permanent: true },

      // Admin route recovery shims: route blocked/exposed surfaces through the known-live AI Manager surface.
      { source: '/admin/taxonomy-ai', destination: '/admin/ai?surface=taxonomy', permanent: false },
      { source: '/admin/taxonomy/ai', destination: '/admin/ai?surface=taxonomy', permanent: false },
      { source: '/admin/meta-accounts', destination: '/admin/ai?surface=meta', permanent: false },
      { source: '/admin/integrations/meta', destination: '/admin/ai?surface=meta', permanent: false },
    ];
  },

  async headers() {
    return [
      {
        source: '/brand/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/manifest.json',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }],
      },
      {
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
