import type { Metadata, Viewport } from 'next';
import './globals.css';

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
    images: [{ url: 'https://www.genspark.ai/api/files/s/cqwG1DPV?cache_control=3600', width: 1200, height: 630, alt: 'NEEJEE' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NEEJEE · Found. Personal.',
    description: 'India\'s finest craft, personally chosen.',
  },
  icons: {
    icon: 'https://www.genspark.ai/api/files/s/ctADvJbT',
    apple: 'https://www.genspark.ai/api/files/s/13E0kG3H',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#F4EFE6',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        {children}
      </body>
    </html>
  );
}
