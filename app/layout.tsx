import type { Viewport } from 'next';
import { Suspense } from 'react';
import localFont from 'next/font/local';
import './globals.css';
import './house.css';
import { AnalyticsProvider } from '@/components/analytics/AnalyticsProvider';
import { PixelScripts } from '@/components/analytics/PixelScripts';
import { PwaRegistrar } from '@/components/pwa/PwaRegistrar';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { CurrencyProvider } from '@/components/i18n/CurrencyProvider';
import { getRootMetadata } from '@/lib/site/seo-config';

const displayFont = localFont({
  src:[{path:'./fonts/playfair.woff2',weight:'400 900',style:'normal'},{path:'./fonts/playfair-italic.woff2',weight:'400 900',style:'italic'}],
  display:'swap',preload:false,variable:'--font-display',
});
const bodyFont = localFont({
  src:[{path:'./fonts/cormorant.woff2',weight:'300 700',style:'normal'},{path:'./fonts/cormorant-italic.woff2',weight:'300 700',style:'italic'}],
  display:'swap',preload:false,variable:'--font-body',
});
const uiFont = localFont({src:'./fonts/inter.woff2',weight:'100 900',display:'swap',variable:'--font-ui'});

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
