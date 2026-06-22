'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CompleteTheLook } from '@/components/product/CompleteTheLook';
import { useCart } from '@/lib/cart-store';
import { formatINR, paiseToRupees } from '@/lib/money';
import { Plus, Minus, X, Gift, Truck, Tag, Check } from 'lucide-react';

const FREE_SHIPPING_THRESHOLD_PAISE = 250000; // ₹2,500

export const dynamic = 'force-dynamic';

export default function CartPage() {
  const { items, removeItem, updateQuantity, itemsSubtotal, giftWrap, setGiftWrap, personalNote, setPersonalNote, couponCode, couponDiscount, applyCoupon, removeCoupon, giftWrapPaise, total } = useCart();
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
    setCouponMsg(''); setApplyingCoupon(true);
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponInput.trim().toUpperCase(), subtotal: sub }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Invalid coupon');
      applyCoupon(d.code, d.discountPaise);
      setCouponMsg(`✓ ${d.code} applied — ${formatINR(d.discountPaise)} off`);
      setCouponInput('');
    } catch (e: any) { setCouponMsg('✗ ' + e.message); }
    finally { setApplyingCoupon(false); }
  };

  if (items.length === 0) {
    return (
      <>
        <Header />
        <section className="max-w-3xl mx-auto px-6 py-24 text-center">
          <p className="label text-madder">YOUR TRUNK</p>
          <h1 className="font-display text-4xl text-kohl mt-3">Empty for now.</h1>
          <p className="font-italic italic text-mitti mt-3">A trunk filled is a trunk loved. Start with the Founder's Edit.</p>
          <div className="madder-divider mx-auto mt-6"></div>
          <div className="mt-10 flex gap-3 justify-center">
            <Link href="/" className="btn-primary">SHOP THE EDIT</Link>
            <Link href="/categories/sarees" className="btn-outline">EXPLORE SAREES</Link>
          </div>
        </section>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <section className="max-w-8xl mx-auto px-6 lg:px-12 py-10">
        <p className="label text-madder">CART</p>
        <h1 className="font-display text-4xl text-kohl mt-2">Your Trunk</h1>
        <p className="font-italic italic text-mitti mt-2">{items.length} piece{items.length > 1 ? 's' : ''} · {items.reduce((s, i) => s + i.quantity, 0)} item{items.reduce((s, i) => s + i.quantity, 0) > 1 ? 's' : ''}</p>
        <div className="madder-divider mt-4"></div>

        <div className="grid lg:grid-cols-[1fr_400px] gap-10 mt-10">
          {/* Items column */}
          <div>
            {/* Free shipping meter */}
            <div className="bg-beige p-5 mb-6">
              <div className="flex items-center gap-3">
                <Truck className="w-5 h-5 text-madder" />
                {shippingFree ? (
                  <p className="font-italic italic text-kohl text-sm">✓ You've unlocked free shipping.</p>
                ) : (
                  <p className="font-italic italic text-kohl text-sm">
                    Add <strong>{formatINR(remaining)}</strong> more for free shipping.
                  </p>
                )}
              </div>
              <div className="mt-3 h-1 bg-ivory rounded-full overflow-hidden">
                <div className="h-full bg-madder transition-all" style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            {/* Cart items */}
            <div className="space-y-6">
              {items.map(item => (
                <div key={`${item.productId}-${item.variantId || ''}`} className="grid grid-cols-[100px_1fr_auto] gap-4 pb-6 border-b border-mitti/15">
                  <Link href={`/products/${item.product.slug}`} className="block aspect-[4/5] bg-beige overflow-hidden">
                    {item.product.images?.[0] && (
                      <Image src={item.product.images[0]} alt={item.product.name} width={100} height={125} className="w-full h-full object-cover" />
                    )}
                  </Link>
                  <div>
                    <Link href={`/products/${item.product.slug}`}>
                      <h3 className="font-display text-lg text-kohl hover:text-madder transition-colors">{item.product.name}</h3>
                    </Link>
                    {item.variantLabel && (
                      <p className="font-ui text-xs text-mitti mt-1">{item.variantLabel}</p>
                    )}
                    <p className="font-ui text-sm text-kohl mt-2">{formatINR(item.product.sellingPrice)} each</p>

                    <div className="mt-3 flex items-center gap-4">
                      <div className="flex items-center border border-mitti/20">
                        <button onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)}
                          className="p-2 hover:bg-beige"><Minus className="w-3 h-3" /></button>
                        <span className="px-4 font-ui text-sm w-10 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)}
                          className="p-2 hover:bg-beige"><Plus className="w-3 h-3" /></button>
                      </div>
                      <button onClick={() => removeItem(item.productId, item.variantId)}
                        className="font-ui text-xs text-mitti hover:text-madder flex items-center gap-1">
                        <X className="w-3 h-3" /> REMOVE
                      </button>
                    </div>
                  </div>
                  <p className="font-display text-lg text-kohl text-right">
                    {formatINR(item.product.sellingPrice * item.quantity)}
                  </p>
                </div>
              ))}
            </div>

            {/* Gift options */}
            <div className="mt-8 bg-beige p-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={giftWrap} onChange={e => setGiftWrap(e.target.checked)} className="mt-1" />
                <div>
                  <div className="flex items-center gap-2">
                    <Gift className="w-4 h-4 text-madder" />
                    <span className="font-display text-base">Add Sandook gift wrap</span>
                    <span className="font-ui text-xs text-mitti">+ ₹150</span>
                  </div>
                  <p className="font-italic italic text-mitti text-sm mt-1">
                    Handmade gift box with NEEJEE thappa seal and a card carrying your note.
                  </p>
                </div>
              </label>
              {giftWrap && (
                <div className="mt-4">
                  <label className="label text-mitti block mb-2">PERSONAL NOTE</label>
                  <textarea rows={3} value={personalNote} onChange={e => setPersonalNote(e.target.value)}
                    placeholder="A line for them — kept handwritten on the card."
                    className="w-full p-3 bg-ivory border border-mitti/20 font-italic italic text-sm" />
                </div>
              )}
            </div>
          </div>

          {/* Summary column */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="bg-beige p-8">
              <p className="label text-madder mb-4">ORDER SUMMARY</p>
              <div className="space-y-2 font-ui text-sm">
                <Row label="Subtotal" value={formatINR(sub)} />
                {wrap > 0 && <Row label="Sandook gift wrap" value={formatINR(wrap)} />}
                {couponApplied && (
                  <Row label={`Coupon · ${couponCode}`} value={`- ${formatINR(couponDiscount)}`} color="text-neem" />
                )}
                <Row label="Shipping" value={shippingFree ? 'Free' : 'Calculated at checkout'} />
                <Row label="GST" value="Inclusive" small />
              </div>
              <div className="border-t border-mitti/20 mt-4 pt-4 flex items-baseline justify-between">
                <span className="font-display text-lg">Total</span>
                <span className="font-display text-2xl text-kohl">{formatINR(grand)}</span>
              </div>

              {/* Coupon */}
              <div className="mt-6 pt-4 border-t border-mitti/20">
                <p className="label text-mitti mb-2 flex items-center gap-2"><Tag className="w-3 h-3" /> COUPON CODE</p>
                {couponApplied ? (
                  <div className="flex items-center justify-between bg-ivory p-3">
                    <span className="font-mono text-sm text-madder">{couponCode}</span>
                    <button onClick={removeCoupon} className="font-ui text-xs text-mitti hover:text-madder">REMOVE</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input value={couponInput} onChange={e => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="WELCOME10" className="flex-1 p-2 bg-ivory border border-mitti/20 font-mono text-sm uppercase" />
                    <button onClick={tryApplyCoupon} disabled={applyingCoupon || !couponInput} className="btn-outline text-xs disabled:opacity-50">
                      {applyingCoupon ? '...' : 'APPLY'}
                    </button>
                  </div>
                )}
                {couponMsg && <p className={`font-ui text-xs mt-2 ${couponMsg.startsWith('✓') ? 'text-neem' : 'text-madder'}`}>{couponMsg}</p>}
              </div>

              <CheckoutCTA />
              <Link href="/" className="block text-center font-ui text-xs tracking-widest text-mitti hover:text-madder mt-4">
                CONTINUE SHOPPING
              </Link>
            </div>

            <div className="mt-4 bg-beige p-5 text-center">
              <p className="font-ui text-[10px] tracking-widest text-mitti">SECURED BY</p>
              <p className="font-display text-sm mt-1">Razorpay · UPI · Cards · NetBanking · COD</p>
            </div>
          </aside>
        </div>
      </section>

      {items.length > 0 && (
        <CompleteTheLook productId={items[0].productId} limit={4} />
      )}

      <Footer />
    </>
  );
}

function Row({ label, value, color, small }: any) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={`text-kohl ${small ? 'text-xs text-mitti' : ''}`}>{label}</span>
      <span className={`font-ui ${color || 'text-kohl'} ${small ? 'text-xs' : ''}`}>{value}</span>
    </div>
  );
}

function CheckoutCTA() {
  const [me, setMe] = useState<{ email: string } | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.email) setMe(d); setChecked(true); })
      .catch(() => setChecked(true));
  }, []);

  if (!checked) {
    return (
      <div className="btn-primary w-full mt-6 block text-center opacity-50 cursor-wait">
        ···
      </div>
    );
  }

  if (me) {
    return (
      <Link href="/checkout" className="btn-primary w-full mt-6 block text-center">
        PROCEED TO CHECKOUT →
      </Link>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      <Link
        href="/login?next=%2Fcheckout"
        className="btn-primary w-full block text-center"
      >
        SIGN IN TO CHECKOUT →
      </Link>
      <Link
        href="/signup?next=%2Fcheckout"
        className="block text-center font-ui text-xs tracking-widest text-mitti hover:text-madder"
      >
        OR CREATE YOUR PERSONAL ACCOUNT
      </Link>
      <p className="text-[10px] tracking-wider text-mitti/70 text-center mt-2">
        Personal pieces deserve a personal account · For order tracking, returns &amp; gifts.
      </p>
    </div>
  );
}
