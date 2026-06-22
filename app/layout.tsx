import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { headers } from 'next/headers';
import './globals.css';
import { AnalyticsProvider } from '@/components/analytics/AnalyticsProvider';
import { PixelScripts } from '@/components/analytics/PixelScripts';
import { PwaRegistrar } from '@/components/pwa/PwaRegistrar';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { CurrencyProvider } from '@/components/i18n/CurrencyProvider';
import { currencyForCountry } from '@/lib/currency';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://neejee.com'),
  title: {
    default: 'NEEJEE · Found. Personal.',
    template: '%s · NEEJEE',
  },
  description: 'India\'s finest craft — hand-woven sarees, oxidised silver, mitti attars, Phulkari dupattas. Personally chosen, founder-verified, fair-trade.',
  keywords: ['Indian craft', 'Banarasi saree', 'Phulkari', 'handloom', 'Kanjeevaram', 'Indian jewellery', 'attar', 'Indian luxury'],
  openGraph: {
    title: 'NEEJEE · Found. Personal.',
    description: 'India\'s finest craft, personally chosen. Hand-woven sarees, oxidised silver, mitti attars.',
    url: 'https://neejee.com',
    siteName: 'NEEJEE',
    locale: 'en_IN',
    type: 'website',
    images: [{ url: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=1200&h=630&fit=crop&q=80&fm=jpg', width: 1200, height: 630, alt: 'NEEJEE — Found. Personal.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NEEJEE · Found. Personal.',
    description: 'India\'s finest craft, personally chosen.',
  },
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/logo-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/brand/logo-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/brand/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'NEEJEE',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#F4EFE6',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Auto-detect currency from Vercel country header
  let initialCurrency = 'INR';
  try {
    const country = headers().get('x-vercel-ip-country');
    initialCurrency = currencyForCountry(country);
  } catch {}

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <PixelScripts />
        <PwaRegistrar />
        <Suspense fallback={null}>
          <AnalyticsProvider />
        </Suspense>
        <CurrencyProvider initialCurrency={initialCurrency}>
          {children}
        </CurrencyProvider>
        <InstallPrompt />
      </body>
    </html>
  );
}
