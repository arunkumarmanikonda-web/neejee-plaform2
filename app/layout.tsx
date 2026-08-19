import type { Viewport } from 'next';
import { Suspense } from 'react';
import { Cormorant_Garamond, Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import './phase25.css';
import './quiet-phase2.css';
import { AnalyticsProvider } from '@/components/analytics/AnalyticsProvider';
import { PixelScripts } from '@/components/analytics/PixelScripts';
import { PwaRegistrar } from '@/components/pwa/PwaRegistrar';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { CurrencyProvider } from '@/components/i18n/CurrencyProvider';
import { getRootMetadata } from '@/lib/site/seo-config';

const displayFont = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-display',
});

const bodyFont = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-body',
});

const uiFont = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  display: 'swap',
  variable: '--font-ui',
});

export const metadata = getRootMetadata();

export const viewport: Viewport = {
  themeColor: '#F4EFE6',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable} ${uiFont.variable}`}>
      <body className="font-body antialiased">
        <PixelScripts />
        <PwaRegistrar />
        <Suspense fallback={null}>
          <AnalyticsProvider />
        </Suspense>
        <CurrencyProvider>{children}</CurrencyProvider>
        <InstallPrompt />
      </body>
    </html>
  );
}
