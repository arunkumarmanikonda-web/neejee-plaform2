import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Track Order',
  description: 'Securely look up a NEEJEE order using the order reference and checkout email.',
  alternates: { canonical: '/help/track' },
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function TrackOrderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
