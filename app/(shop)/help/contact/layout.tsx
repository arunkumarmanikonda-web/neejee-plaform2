import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Current ways to contact NEEJEE for orders, product questions, support and privacy requests.',
  alternates: { canonical: '/help/contact' },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
