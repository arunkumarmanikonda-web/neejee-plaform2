import { prisma } from '@/lib/prisma';
import { calculateGST } from '@/lib/utils';
import { resolveShippingOptions } from '@/lib/shipping/resolve';
import type { ShippingResolveInput } from '@/lib/shipping/resolve';
const GIFT_WRAP_PAISE = 15000;
const MAX_LINE_QUANTITY = 50;
const COD_MAX_PAISE = 2500000;
export class CheckoutPricingError extends Error {
  readonly detail: {error:string; code?:string};
  readonly status: number;
  constructor(detail: {error:string; code?:string}, {status}: {status:number}) {
    super(detail.error); this.detail = detail; this.status = status;
  }
}
type Line = {productId?: string; variantId?: string | null; quantity?: number};
type Inputs = {
  items:Line[]; address:{pincode:string; state:string}; shipping:ShippingResolveInput['mode'];
  giftWrap?:boolean; couponCode?:string; pointsToRedeem?:number;
};
export async function calculateCheckoutPricing(input:Inputs, session:{id:string} | null, includeLoyalty = false) {
  const {items, address, shipping, giftWrap, couponCode, pointsToRedeem = 0} = input;
  if (!Array.isArray(items) || !items.length || items.length > 250)
    throw new CheckoutPricingError({error:'Choose between 1 and 250 bag lines.'}, {status:400});
  if (!address || typeof address.state !== 'string' || !address.state.trim() || address.state.length > 120 ||
      typeof address.pincode !== 'string' || !/^\d{6}$/.test(address.pincode) || !['STANDARD','EXPRESS'].includes(shipping))
    throw new CheckoutPricingError({error:'Enter a delivery state, six-digit pincode and shipping method.'}, {status:400});
  let subtotal = 0;
  let allCodEligible = true;
  const verifiedItems: Array<{
    productId: string;
    variantId: string | null;
    quantity: number;
    price: number;
    total: number;
    name: string;
    craft?: string | null;
    region?: string | null;
  }> = [];

  const productIds = [...new Set(items.map(item => String(item?.productId || '').trim()))];
  const products = await prisma.product.findMany({
    where: { id: {in: productIds} },
    select: {id:true,name:true,status:true,takedownAt:true,catalogueExclude:true,codEligible:true,sellingPrice:true,salePrice:true,saleStartsAt:true,saleEndsAt:true,
      craft:true,region:true,variants:{ select:{id:true,inventory:true,sellingPrice:true} }},
  });
  const byId = new Map(products.map(product => [product.id, product]));
  for (const rawItem of items) {
    const productId = String(rawItem?.productId || '').trim();
    const quantity = Number(rawItem?.quantity);
    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
      throw new CheckoutPricingError({ error: 'Invalid cart quantity' }, { status: 400 });
    }

    const product = byId.get(productId);
    if (!product) {
      throw new CheckoutPricingError({ error: 'A selected product could not be found' }, { status: 400 });
    }
    if (product.status !== 'ACTIVE' || product.takedownAt || product.catalogueExclude) {
      throw new CheckoutPricingError({ error: `${product.name} is currently unavailable` }, { status: 409 });
    }
    if (product.codEligible === false) allCodEligible = false;

    const now = new Date();
    let price = Number(product.sellingPrice || 0);
    if (
      product.salePrice &&
      (!product.saleStartsAt || product.saleStartsAt <= now) &&
      (!product.saleEndsAt || product.saleEndsAt >= now)
    ) {
      price = Number(product.salePrice);
    }
    if (!Number.isInteger(price) || price < 0) {
      throw new CheckoutPricingError({ error: `${product.name} has invalid pricing` }, { status: 409 });
    }

    let variantId: string | null = null;
    if (rawItem.variantId) {
      const variant = product.variants.find((v: any) => v.id === rawItem.variantId);
      if (!variant) throw new CheckoutPricingError({ error: 'Selected variant not found' }, { status: 409 });
      if (variant.inventory < quantity) {
        throw new CheckoutPricingError({ error: `Only ${variant.inventory} left of ${product.name}`, code: 'INVENTORY_CHANGED' }, { status: 409 });
      }
      variantId = variant.id;
      if (variant.sellingPrice != null) price = Number(variant.sellingPrice);
    } else if (product.variants.length > 0) {
      const availableVariants = product.variants.filter((v: any) => v.inventory >= quantity);
      if (availableVariants.length !== 1) {
        throw new CheckoutPricingError({
          error: availableVariants.length === 0
            ? `Out of stock: ${product.name}`
            : `Please choose the exact option for ${product.name}`,
          code: availableVariants.length === 0 ? 'INVENTORY_CHANGED' : 'VARIANT_REQUIRED',
        }, { status: 409 });
      }
      variantId = availableVariants[0].id;
      if (availableVariants[0].sellingPrice != null) price = Number(availableVariants[0].sellingPrice);
    } else {
      throw new CheckoutPricingError({
        error: `${product.name} is not configured with a purchasable variant`,
        code: 'PRODUCT_UNAVAILABLE',
      }, { status: 409 });
    }

    if (!Number.isSafeInteger(price) || price <= 0) throw new CheckoutPricingError({error:'The selected option has invalid pricing.'}, {status:409});
    const lineTotal = price * quantity;
    subtotal += lineTotal;
    verifiedItems.push({
      productId: product.id,
      variantId,
      quantity,
      price,
      total: lineTotal,
      name: product.name,
      craft: product.craft || null,
      region: product.region || null,
    });
  }

  const wrap = giftWrap ? GIFT_WRAP_PAISE : 0;
  const { rates } = await resolveShippingOptions({
    pincode: address.pincode,
    state: address.state,
    subtotalPaise: subtotal,
  });
  let shippingPaise = rates[shipping];

  let discountPaise = 0;
  let appliedCouponId: string | null = null;
  if (couponCode) {
    const normalizedCouponCode = String(couponCode).toUpperCase().trim();
    const coupon = await prisma.coupon.findUnique({ where: { code: normalizedCouponCode } });
    if (!coupon) {
      throw new CheckoutPricingError({ error: 'Coupon not found', code: 'COUPON_NOT_FOUND' }, { status: 400 });
    }
    if (!coupon.active) {
      throw new CheckoutPricingError({ error: 'Coupon is inactive', code: 'COUPON_INACTIVE' }, { status: 400 });
    }

    const now = new Date();
    if (coupon.validFrom && coupon.validFrom > now) {
      throw new CheckoutPricingError({ error: 'Coupon not yet active', code: 'COUPON_NOT_YET_ACTIVE' }, { status: 400 });
    }
    if (coupon.validTo && coupon.validTo < now) {
      throw new CheckoutPricingError({ error: 'Coupon has expired', code: 'COUPON_EXPIRED' }, { status: 400 });
    }
    if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
      throw new CheckoutPricingError({ error: 'Coupon usage limit reached', code: 'COUPON_USAGE_LIMIT' }, { status: 409 });
    }
    if (coupon.minCart != null && subtotal < coupon.minCart) {
      throw new CheckoutPricingError({
        error: `Minimum cart of ₹${(coupon.minCart / 100).toLocaleString('en-IN')} required`,
        code: 'COUPON_MIN_CART',
      }, { status: 400 });
    }
    if (coupon.userId) {
      if (!session?.id) {
        throw new CheckoutPricingError({ error: 'Please sign in to use this code', code: 'COUPON_SIGN_IN_REQUIRED' }, { status: 401 });
      }
      if (coupon.userId !== session.id) {
        throw new CheckoutPricingError({ error: 'This code belongs to another account', code: 'COUPON_WRONG_USER' }, { status: 403 });
      }
    }
    if (coupon.perUserOnce) {
      if (!session?.id) {
        throw new CheckoutPricingError({ error: 'Please sign in to use this one-time code', code: 'COUPON_SIGN_IN_REQUIRED' }, { status: 401 });
      }
      const used = await prisma.couponRedemption.findUnique({
        where: { couponId_userId: { couponId: coupon.id, userId: session.id } },
      });
      if (used) {
        throw new CheckoutPricingError({ error: 'You have already used this code', code: 'COUPON_ALREADY_USED' }, { status: 400 });
      }
    }

    if (coupon.type === 'PERCENT') {
      discountPaise = Math.round((subtotal * coupon.value) / 100);
      if (coupon.maxDiscount && discountPaise > coupon.maxDiscount) discountPaise = coupon.maxDiscount;
    } else if (coupon.type === 'FLAT') {
      discountPaise = Math.min(coupon.value, subtotal);
    } else if (coupon.type === 'FREE_SHIPPING') {
      rates.STANDARD = 0;
      rates.EXPRESS = 0;
      shippingPaise = 0;
    }
    appliedCouponId = coupon.id;
  }

  let pointsRedeemed = 0;
  let pointsValuePaise = 0;
  let loyalty: {balance:number; maxUsable:number; maxPaiseValue:number} | null = null;
  if (session && (includeLoyalty || pointsToRedeem > 0)) {
    const { getCurrentBalance } = await import('@/lib/loyalty');
    const [balance, settings] = await Promise.all([getCurrentBalance(session.id), prisma.loyaltySettings.findUnique({
      where:{id:'singleton'}, select:{minRedemption:true,maxRedemptionPct:true,redemptionValue:true},
    })]);
    // Mirror the schema defaults on uninitialised installations without seeding rows during a quote.
    const {minRedemption,maxRedemptionPct,redemptionValue} = settings || {minRedemption:100,maxRedemptionPct:50,redemptionValue:100};
    const beforePoints = Math.max(0, subtotal + wrap + shippingPaise - discountPaise);
    const maxUsable = redemptionValue > 0 ? Math.min(balance, Math.floor(beforePoints * maxRedemptionPct / (100 * redemptionValue))) : 0;
    if (maxUsable >= minRedemption && maxUsable > 0) {
      loyalty = {balance,maxUsable,maxPaiseValue:maxUsable * redemptionValue};
      const requested = Math.min(maxUsable, Math.max(0, Math.floor(Number(pointsToRedeem) || 0)));
      if (requested >= minRedemption) { pointsRedeemed = requested; pointsValuePaise = requested * redemptionValue; }
    }
  }

  const totalBeforeTax = subtotal + wrap + shippingPaise - discountPaise - pointsValuePaise;
  const tax = calculateGST(totalBeforeTax, 5);
  const total = totalBeforeTax;
  return { subtotal, wrap, rates, shippingPaise, discountPaise, appliedCouponId, pointsRedeemed, pointsValuePaise,
    total, tax, loyalty, allCodEligible, codAvailable:allCodEligible && total <= COD_MAX_PAISE, verifiedItems };

}
