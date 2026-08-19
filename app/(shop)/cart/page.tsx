'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CompleteTheLook } from '@/components/product/CompleteTheLook';
import { useCart } from '@/lib/cart-store';
import { formatINR } from '@/lib/money';
import { Plus, Minus, X, Gift, Truck, Tag, ShieldCheck } from 'lucide-react';

const FREE_SHIPPING_THRESHOLD_PAISE = 250000;
export const dynamic = 'force-dynamic';

export default function CartPage() {
  const {
    items,
    removeItem,
    updateQuantity,
    itemsSubtotal,
    giftWrap,
    setGiftWrap,
    personalNote,
    setPersonalNote,
    couponCode,
    couponDiscount,
    applyCoupon,
    removeCoupon,
    giftWrapPaise,
    total,
  } = useCart();

  const [couponInput, setCouponInput] = useState('');
  const [couponMsg, setCouponMsg] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const sub = itemsSubtotal();
  const wrap = giftWrapPaise();
  const couponApplied = couponCode && couponDiscount > 0;
  const grand = total();
  const progressPct = Math.min(100, (sub / FREE_SHIPPING_THRESHOLD_PAISE) * 100);
  const shippingFree = sub >= FREE_SHIPPING_THRESHOLD_PAISE;
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD_PAISE - sub);

  const tryApplyCoupon = async () => {
    setCouponMsg('');
    setApplyingCoupon(true);
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponInput.trim().toUpperCase(), subtotal: sub }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid coupon');
      applyCoupon(data.code, data.discountPaise);
      setCouponMsg(`✓ ${data.code} applied · ${formatINR(data.discountPaise)} off`);
      setCouponInput('');
    } catch (e: any) {
      setCouponMsg('✗ ' + e.message);
    } finally {
      setApplyingCoupon(false);
    }
  };

  if (items.length === 0) {
    return (
      <>
        <Header />
        <section className="max-w-3xl mx-auto px-6 py-28 md:py-36 text-center">
          <p className="editorial-kicker">YOUR TRUNK</p>
          <h1 className="font-display text-[48px] md:text-[62px] leading-none text-kohl mt-4">Empty, for now.</h1>
          <div className="ornament-rule justify-center mt-6"><span className="font-display italic text-mitti">A piece becomes personal when you choose it.</span></div>
          <div className="mt-10 flex flex-wrap gap-3 justify-center">
            <Link href="/" className="btn-primary">SHOP THE EDIT</Link>
            <Link href="/categories/women-sarees" className="btn-outline">EXPLORE SAREES</Link>
          </div>
        </section>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />

      <section className="max-w-[1600px] mx-auto px-5 sm:px-8 lg:px-12 pt-10 md:pt-14 pb-16">
        <p className="editorial-kicker">YOUR NEEJEE</p>
        <div className="flex flex-wrap items-end justify-between gap-4 mt-2">
          <div>
            <h1 className="font-display text-[50px] md:text-[66px] leading-none text-kohl">Your trunk</h1>
            <p className="font-display italic text-mitti text-[15px] mt-3">
              {items.reduce((sum, item) => sum + item.quantity, 0)} {items.reduce((sum, item) => sum + item.quantity, 0) === 1 ? 'piece' : 'pieces'}, chosen personally.
            </p>
          </div>
          <Link href="/" className="micro-link mb-1">CONTINUE THE EDIT →</Link>
        </div>
        <div className="madder-divider mt-6" />

        <div className="grid lg:grid-cols-[1fr_430px] xl:grid-cols-[1fr_470px] gap-10 xl:gap-14 mt-11">
          <div className="min-w-0">
            <div className="border-y border-mitti/15 py-4 mb-8">
              <div className="flex items-center gap-3">
                <Truck className="w-4 h-4 text-madder" strokeWidth={1.35} />
                <p className="font-display italic text-kohl text-[13px]">
                  {shippingFree ? 'Free shipping is part of this trunk.' : <>Add <strong className="font-normal text-madder">{formatINR(remaining)}</strong> more for free shipping.</>}
                </p>
              </div>
              <div className="mt-3 h-px bg-mitti/15 overflow-hidden">
                <div className="h-full bg-madder transition-all" style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            <div className="space-y-8 md:space-y-10">
              {items.map((item) => (
                <article key={`${item.productId}-${item.variantId || ''}`} className="grid grid-cols-[112px_1fr] sm:grid-cols-[170px_1fr_auto] xl:grid-cols-[210px_1fr_auto] gap-4 sm:gap-6 pb-8 md:pb-10 border-b border-mitti/15">
                  <Link href={`/products/${item.product.slug}`} className="block aspect-square sm:aspect-[4/3] bg-beige overflow-hidden border border-mitti/12">
                    {item.product.images?.[0] ? (
                      <Image src={item.product.images[0]} alt={item.product.name} width={420} height={315} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-display italic text-xs text-mitti">Image being prepared</div>
                    )}
                  </Link>

                  <div className="min-w-0 py-1">
                    <p className="editorial-kicker">NEEJEE SELECT</p>
                    <Link href={`/products/${item.product.slug}`}>
                      <h2 className="font-display text-[21px] md:text-[25px] leading-tight text-kohl hover:text-madder transition-colors mt-1.5">{item.product.name}</h2>
                    </Link>
                    {item.variantLabel && <p className="font-ui text-[9px] tracking-[0.14em] text-mitti mt-2">{item.variantLabel.toUpperCase()}</p>}
                    <p className="font-display text-[17px] text-kohl mt-3">{formatINR(item.product.sellingPrice)}</p>

                    <div className="mt-5 flex flex-wrap items-center gap-4">
                      <div className="flex items-center border border-mitti/25">
                        <button onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)} className="p-2.5 hover:bg-beige" aria-label="Decrease quantity"><Minus className="w-3 h-3" strokeWidth={1.3} /></button>
                        <span className="px-3 font-ui text-xs min-w-10 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)} className="p-2.5 hover:bg-beige" aria-label="Increase quantity"><Plus className="w-3 h-3" strokeWidth={1.3} /></button>
                      </div>
                      <button onClick={() => removeItem(item.productId, item.variantId)} className="font-ui text-[9px] tracking-[0.15em] text-mitti hover:text-madder flex items-center gap-1.5"><X className="w-3 h-3" strokeWidth={1.4} /> REMOVE</button>
                    </div>
                  </div>

                  <div className="hidden sm:block text-right py-1">
                    <p className="font-ui text-[8px] tracking-[0.15em] text-mitti">TOTAL</p>
                    <p className="font-display text-[20px] text-kohl mt-1">{formatINR(item.product.sellingPrice * item.quantity)}</p>
                  </div>
                </article>
              ))}
            </div>

            <section className="mt-10 border border-mitti/18 bg-paper-deep/45 p-6 md:p-7">
              <label className="flex items-start gap-4 cursor-pointer">
                <input type="checkbox" checked={giftWrap} onChange={(e) => setGiftWrap(e.target.checked)} className="mt-1 accent-[#8B2E2A]" />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Gift className="w-4 h-4 text-madder" strokeWidth={1.35} />
                    <span className="font-display text-[18px]">Sandook gift presentation</span>
                    <span className="font-ui text-[9px] tracking-wider text-mitti">+ ₹150</span>
                  </div>
                  <p className="font-display italic text-mitti text-[13px] mt-1.5">NEEJEE seal, considered presentation and a card carrying your note.</p>
                </div>
              </label>

              {giftWrap && (
                <div className="mt-5 pt-5 border-t border-mitti/15">
                  <label className="font-ui text-[9px] tracking-[0.18em] text-mitti block mb-2">A PERSONAL NOTE</label>
                  <textarea rows={3} value={personalNote} onChange={(e) => setPersonalNote(e.target.value)} placeholder="A line for them." className="neejee-field font-display italic text-sm resize-none" />
                </div>
              )}
            </section>
          </div>

          <aside className="lg:sticky lg:top-[122px] lg:self-start">
            <div className="paper-panel p-7 md:p-8 xl:p-9">
              <p className="editorial-kicker">YOUR ORDER</p>
              <h2 className="font-display text-[29px] text-kohl mt-2">The trunk, in full.</h2>
              <div className="madder-divider mt-5 mb-6" />

              <div className="space-y-3 font-display text-[14px]">
                <Row label="Subtotal" value={formatINR(sub)} />
                {wrap > 0 && <Row label="Sandook gift presentation" value={formatINR(wrap)} />}
                {couponApplied && <Row label={`Coupon · ${couponCode}`} value={`− ${formatINR(couponDiscount)}`} color="text-neem" />}
                <Row label="Shipping" value={shippingFree ? 'Complimentary' : 'At checkout'} />
                <Row label="GST" value="Included" small />
              </div>

              <div className="border-t border-mitti/20 mt-5 pt-5 flex items-baseline justify-between gap-5">
                <span className="font-display text-[18px]">Total</span>
                <span className="font-display text-[30px] text-kohl">{formatINR(grand)}</span>
              </div>

              <div className="mt-7 pt-5 border-t border-mitti/20">
                <p className="font-ui text-[9px] tracking-[0.18em] text-mitti mb-2.5 flex items-center gap-2"><Tag className="w-3.5 h-3.5" strokeWidth={1.35} /> PROMOTION CODE</p>
                {couponApplied ? (
                  <div className="flex items-center justify-between bg-ivory/70 border border-mitti/15 p-3">
                    <span className="font-ui text-xs tracking-wider text-madder">{couponCode}</span>
                    <button onClick={removeCoupon} className="font-ui text-[9px] tracking-wider text-mitti hover:text-madder">REMOVE</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="CODE" className="neejee-field !py-2.5 font-ui text-xs uppercase min-w-0" />
                    <button onClick={tryApplyCoupon} disabled={applyingCoupon || !couponInput} className="btn-outline !px-4 !py-2.5 disabled:opacity-50">{applyingCoupon ? '…' : 'APPLY'}</button>
                  </div>
                )}
                {couponMsg && <p className={`font-ui text-[9px] tracking-wide mt-2 ${couponMsg.startsWith('✓') ? 'text-neem' : 'text-madder'}`}>{couponMsg}</p>}
              </div>

              <CheckoutCTA />
              <p className="font-ui text-[8px] tracking-[0.12em] leading-relaxed text-mitti/75 text-center mt-4">FINAL PRICE, STOCK AND PAYMENT ELIGIBILITY ARE VERIFIED AGAIN AT CHECKOUT.</p>
            </div>

            <div className="mt-4 border border-mitti/15 px-5 py-4 flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-madder flex-shrink-0 mt-0.5" strokeWidth={1.35} />
              <div>
                <p className="font-ui text-[8px] tracking-[0.18em] text-kohl">SECURE COMMERCE</p>
                <p className="font-display italic text-[12px] text-mitti mt-1">Razorpay, UPI, cards, NetBanking and eligible COD orders.</p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {items.length > 0 && <CompleteTheLook productId={items[0].productId} limit={4} />}
      <Footer />
    </>
  );
}

function Row({ label, value, color, small }: any) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={`${small ? 'font-ui text-[9px] tracking-wider text-mitti' : 'text-kohl/80'}`}>{label}</span>
      <span className={`${color || 'text-kohl'} ${small ? 'font-ui text-[9px] tracking-wider' : ''} text-right`}>{value}</span>
    </div>
  );
}

function CheckoutCTA() {
  const [me, setMe] = useState<{ email: string } | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch('/api/me', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.email) setMe(data);
        setChecked(true);
      })
      .catch(() => setChecked(true));
  }, []);

  if (!checked) return <div className="btn-primary w-full mt-7 block text-center opacity-50 cursor-wait">···</div>;

  if (me) {
    return <Link href="/checkout" className="btn-primary w-full mt-7 block text-center">PROCEED TO CHECKOUT →</Link>;
  }

  return (
    <div className="mt-7 space-y-3">
      <Link href="/checkout" className="btn-primary w-full block text-center">CONTINUE AS GUEST →</Link>
      <Link href="/login?next=%2Fcheckout" className="btn-outline w-full block text-center">SIGN IN</Link>
      <p className="font-display italic text-[12px] leading-relaxed text-mitti text-center">An account is not required to purchase.</p>
    </div>
  );
}
