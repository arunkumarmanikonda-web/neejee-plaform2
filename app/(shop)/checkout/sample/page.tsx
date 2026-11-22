import { notFound } from 'next/navigation';
import { previewPricingEnabled } from '@/lib/shop-studies';
import { SampleShopping } from '@/components/shop/SampleShopping';

export const metadata = { title: 'Sample checkout | Neejee', robots: { index: false } };
export const dynamic = 'force-dynamic';
export default function Page() {
  if (!previewPricingEnabled()) notFound();
  return <SampleShopping checkout/>;
}
