import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Your Trunk',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return <div className="neejee-cart-v25">{children}</div>;
}
