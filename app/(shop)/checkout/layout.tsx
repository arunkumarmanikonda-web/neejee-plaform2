import type { Metadata } from 'next';
import './checkout-phase2.css';

export const metadata: Metadata = {
  title: 'Checkout · NEEJEE',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function CheckoutVisualLayout({ children }: { children: React.ReactNode }) {
  return <div className="checkout-phase2">{children}</div>;
}
