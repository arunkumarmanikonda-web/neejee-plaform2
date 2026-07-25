import type { Viewport } from 'next';
import { Suspense } from 'react';
import { headers } from 'next/headers';
import './globals.css';
import { AnalyticsProvider } from '@/components/analytics/AnalyticsProvider';
import { PixelScripts } from '@/components/analytics/PixelScripts';
import { PwaRegistrar } from '@/components/pwa/PwaRegistrar';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { CurrencyProvider } from '@/components/i18n/CurrencyProvider';
import { currencyForCountry } from '@/lib/currency';
import { getRootMetadata } from '@/lib/site/seo-config';

export const metadata = getRootMetadata();

export const viewport: Viewport = {
  themeColor: '#F4EFE6',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Inter:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
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