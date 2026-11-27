import { cookies } from 'next/headers';
import { reviewCookie } from '@/lib/collection-review';
import { CollectionCheckout } from '@/components/checkout/CollectionCheckout';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default async function CheckoutLayout({ children }: { children: React.ReactNode }) {
  if ((await cookies()).get(reviewCookie)?.value === '1') return <CollectionCheckout/>;
  return <>{children}</>;
}
