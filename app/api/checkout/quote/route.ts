import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { calculateCheckoutPricing, CheckoutPricingError } from '@/lib/checkout/pricing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const input = await request.json().catch(() => null);
  if (!input || typeof input !== 'object') return NextResponse.json({error:'Invalid quote request.'}, {status:400});
  try {
    const pricing = await calculateCheckoutPricing(input, await getSession(), true);
    const {subtotal, wrap, rates, shippingPaise, discountPaise, pointsRedeemed, pointsValuePaise, total, codAvailable, loyalty} = pricing;
    return NextResponse.json({subtotal, wrap, rates, shippingPaise, discountPaise, pointsRedeemed, pointsValuePaise, total, codAvailable, loyalty,
      lineTotals:pricing.verifiedItems.map(item => item.total)}, {headers:{'Cache-Control':'private, no-store'}});
  } catch (error) {
    if (error instanceof CheckoutPricingError) return NextResponse.json(error.detail, {status:error.status});
    return NextResponse.json({error:'Delivery pricing is temporarily unavailable. Please retry.'}, {status:503});
  }
}
