import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Your bag',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
