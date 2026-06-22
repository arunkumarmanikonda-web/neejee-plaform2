'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useCart } from '@/lib/cart-store';
import { formatINR } from '@/lib/money';
import { Check, ShieldCheck } from 'lucide-react';
import { readUtm } from '@/lib/analytics';

export const dynamic = 'force-dynamic';

const STEPS = ['ADDRESS', 'SHIPPING', 'PAYMENT'] as const;
type Step = typeof STEPS[number];

export default function CheckoutPage() {
  const router = useRouter();
  const { items, itemsSubtotal, giftWrapPaise, couponDiscount, couponCode, total, clear, giftWrap, personalNote } = useCart();
  const [step, setStep] = useState<Step>('ADDRESS');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [me, setMe] = useState<any>(null);

  const [contact, setContact] = useState({ email: '', phone: '' });
  const [address, setAddress] = useState({
    name: '', line1: '', line2: '', city: '', state: '', pincode: '', country: 'India',
  });
  const [shipping, setShipping] = useState('STANDARD'); // STANDARD | EXPRESS
  const [payment, setPayment] = useState('RAZORPAY'); // RAZORPAY | COD
  const [gstinCustomer, setGstinCustomer] = useState('');
  const [wantGstInvoice, setWantGstInvoice] = useState(false);
  const [loyaltyPreview, setLoyaltyPreview] = useState<any>(null);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  const [authChecking, setAuthChecking] = useState(true);

// v26.3a — Fire abandonment beacon when user leaves checkout/payment
  useEffect(() => {
    const handler = () => {
      try {
        const id = sessionStorage.getItem('neejee_checkout_snapshot');
        if (!id) return;
        const blob = new Blob([JSON.stringify({ snapshotId: id, step })], { type: 'application/json' });
        navigator.sendBeacon('/api/checkout/abandon', blob);
      } catch {}
    };
    window.addEventListener('beforeunload', handler);
    window.addEventListener('pagehide', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      window.removeEventListener('pagehide', handler);
    };
  }, [step]);

    useEffect(() => {
    fetch('/api/me', { credentials: 'include' }).then(r => r.ok ? r.json() : null).then(d => {
      if (d?.email) {
        setMe(d);
        setContact({ email: d.email, phone: d.phone || '' });
        if (d.name) setAddress(a => ({ ...a, name: d.name }));
        setAuthChecking(false);
      } else {
        // Not logged in — redirect to login with return URL
        router.replace('/login?next=%2Fcheckout');
      }
    }).catch(() => {
      router.replace('/login?next=%2Fcheckout');
    });
  }, [router]);

  // Fetch loyalty preview when subtotal changes and user is signed in.
  // IMPORTANT: this hook MUST be declared before any early returns to satisfy
  // React's Rules of Hooks. The values it reads (sub/wrap/shippingCost) are
  // safe to compute inline because they don't depend on hook order.
  useEffect(() => {
    const subNow = itemsSubtotal();
    const wrapNow = giftWrapPaise();
    const shipNow = shipping === 'EXPRESS' ? 25000 : (subNow >= 250000 ? 0 : 15000);
    if (!me?.id || subNow === 0) { setLoyaltyPreview(null); return; }
    fetch('/api/loyalty/preview', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subtotal: subNow + wrapNow + shipNow - couponDiscount }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.canRedeem) setLoyaltyPreview(d); else setLoyaltyPreview(null); })
      .catch(() => setLoyaltyPreview(null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsSubtotal, giftWrapPaise, shipping, couponDiscount, me?.id]);

  if (authChecking) {
    return (
      <>
        <Header />
        <div className="max-w-2xl mx-auto py-32 px-6 text-center">
          <p className="font-italic italic text-mitti">Personal moment…</p>
        </div>
        <Footer />
      </>
    );
  }

  if (items.length === 0) {
    return (
      <>
        <Header />
        <div className="max-w-2xl mx-auto py-20 px-6 text-center">
          <h1 className="font-display text-3xl text-kohl">Your trunk is empty.</h1>
          <Link href="/" className="btn-primary mt-6 inline-block">SHOP THE EDIT</Link>
        </div>
        <Footer />
      </>
    );
  }

  const sub = itemsSubtotal();
  const wrap = giftWrapPaise();
  const shippingCost = shipping === 'EXPRESS' ? 25000 : (sub >= 250000 ? 0 : 15000);
  const pointsValuePaise = pointsToRedeem * (loyaltyPreview?.redemptionValue || 100);
  const grand = Math.max(0, sub + wrap + shippingCost - couponDiscount - pointsValuePaise);

  const stepIdx = STEPS.indexOf(step);

  const validateAddress = () => {
    if (!contact.email || !contact.phone) { setError('Email and phone are required'); return false; }
    if (!address.name || !address.line1 || !address.city || !address.state || !address.pincode) {
      setError('Please fill all address fields'); return false;
    }
    if (!/^\d{6}$/.test(address.pincode)) { setError('Pincode must be 6 digits'); return false; }
    setError(''); return true;
  };

  const placeOrder = async () => {
    setSubmitting(true); setError('');
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
            price: i.product.sellingPrice,
          })),
          contact, address, shipping, payment,
          giftWrap, personalNote,
          couponCode,
          gstinCustomer: wantGstInvoice ? gstinCustomer : null,
          utm: readUtm() || undefined,
          pointsToRedeem,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Order failed');
      // v26.3a — Split COD vs PREPAID routing
      if (payment === 'COD') {
        clear();
        router.push(`/order-confirmation?order=${d.orderNumber}`);
      } else {
        // PREPAID: server returned a snapshotId (no Order yet). Do NOT clear
        // the cart until /verify confirms payment.
        if (d.snapshotId) {
          try { sessionStorage.setItem('neejee_checkout_snapshot', d.snapshotId); } catch {}
        }
        router.push(`/payment?snapshot=${d.snapshotId}`);
      }
    } catch (e: any) { setError(e.message); setSubmitting(false); }
  };

  return (
    <>
      <Header />
      <section className="max-w-6xl mx-auto px-6 lg:px-12 py-10">
        <p className="label text-madder">CHECKOUT</p>
        <h1 className="font-display text-4xl text-kohl mt-2">Almost yours.</h1>
        <div className="madder-divider mt-4"></div>

        {/* Step indicator */}
        <div className="mt-8 flex items-center gap-3 font-ui text-xs tracking-widest">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                i < stepIdx ? 'bg-neem text-ivory' : i === stepIdx ? 'bg-kohl text-ivory' : 'bg-beige text-mitti'
              }`}>
                {i < stepIdx ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              <span className={i === stepIdx ? 'text-kohl' : 'text-mitti'}>{s}</span>
              {i < STEPS.length - 1 && <span className="text-mitti">·</span>}
            </div>
          ))}
        </div>

        {error && <p className="mt-6 font-ui text-sm text-madder bg-madder/10 p-3">{error}</p>}

        <div className="grid lg:grid-cols-[1fr_400px] gap-10 mt-10">
          <div className="space-y-6">
            {step === 'ADDRESS' && (
              <div className="bg-beige p-6">
                <p className="label text-madder mb-4">CONTACT</p>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Email *" value={contact.email} onChange={(v: string) => setContact({...contact, email: v})} type="email" />
                  <Input label="Phone *" value={contact.phone} onChange={(v: string) => setContact({...contact, phone: v})} placeholder="+91 ..." />
                </div>

                <p className="label text-madder mt-8 mb-4">SHIPPING ADDRESS</p>
                <Input label="Full Name *" value={address.name} onChange={(v: string) => setAddress({...address, name: v})} />
                <Input label="Address Line 1 *" value={address.line1} onChange={(v: string) => setAddress({...address, line1: v})} placeholder="Flat / House / Building" />
                <Input label="Address Line 2" value={address.line2} onChange={(v: string) => setAddress({...address, line2: v})} placeholder="Street / Area / Landmark" />
                <div className="grid grid-cols-3 gap-3">
                  <Input label="City *" value={address.city} onChange={(v: string) => setAddress({...address, city: v})} />
                  <Input label="State *" value={address.state} onChange={(v: string) => setAddress({...address, state: v})} />
                  <Input label="Pincode *" value={address.pincode} onChange={(v: string) => setAddress({...address, pincode: v.replace(/\D/g, '').slice(0, 6)})} inputMode="numeric" />
                </div>

                <label className="flex items-start gap-2 mt-6 cursor-pointer">
                  <input type="checkbox" checked={wantGstInvoice} onChange={e => setWantGstInvoice(e.target.checked)} className="mt-1" />
                  <span className="font-ui text-sm text-kohl">I need a GST invoice (for business purchases)</span>
                </label>
                {wantGstInvoice && (
                  <Input label="GSTIN" value={gstinCustomer} onChange={(v: string) => setGstinCustomer(v.toUpperCase())} placeholder="27AAACN1234A1Z5" mono />
                )}

                <div className="mt-8 flex justify-end">
                  <button onClick={() => {
                    if (validateAddress()) {
                      // Snapshot for abandoned-cart recovery (fire-and-forget)
                      fetch('/api/cart/snapshot', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          email: contact.email,
                          subtotal: itemsSubtotal,
                          items: items.map(i => ({
                            name: i.product.name,
                            productId: i.productId,
                            variantId: i.variantId,
                            quantity: i.quantity,
                            price: i.product.sellingPrice,
                          })),
                        }),
                      }).catch(() => {});
                      setStep('SHIPPING');
                    }
                  }} className="btn-primary">
                    CONTINUE TO SHIPPING →
                  </button>
                </div>
              </div>
            )}

            {step === 'SHIPPING' && (
              <div className="bg-beige p-6">
                <p className="label text-madder mb-4">SHIPPING METHOD</p>
                <div className="space-y-3">
                  <ShippingOption value="STANDARD" current={shipping} onSelect={setShipping}
                    label="Standard" sub="4-7 business days" price={sub >= 250000 ? 0 : 15000} />
                  <ShippingOption value="EXPRESS" current={shipping} onSelect={setShipping}
                    label="Express" sub="2-3 business days · India only" price={25000} />
                </div>
                <div className="mt-8 flex justify-between">
                  <button onClick={() => setStep('ADDRESS')} className="font-ui text-xs tracking-widest text-mitti hover:text-madder">← BACK</button>
                  <button onClick={() => setStep('PAYMENT')} className="btn-primary">CONTINUE TO PAYMENT →</button>
                </div>
              </div>
            )}

            {step === 'PAYMENT' && (
              <div className="bg-beige p-6">
                <p className="label text-madder mb-4">PAYMENT METHOD</p>
                <div className="space-y-3">
                  <PaymentOption value="RAZORPAY" current={payment} onSelect={setPayment}
                    label="UPI / Card / Net Banking / Wallet" sub="Secured by Razorpay" />
                  <PaymentOption value="COD" current={payment} onSelect={setPayment}
                    label="Cash on Delivery" sub="Available for orders below ₹25,000" disabled={grand > 2500000} />
                </div>

                <div className="mt-6 bg-ivory p-4 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-madder flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-display text-sm">Authenticity guaranteed</p>
                    <p className="font-italic italic text-mitti text-xs mt-1">
                      Every piece is founder-verified. Hand-inspected before dispatch. Sealed with the NEEJEE thappa.
                    </p>
                  </div>
                </div>

                <div className="mt-8 flex justify-between items-center">
                  <button onClick={() => setStep('SHIPPING')} className="font-ui text-xs tracking-widest text-mitti hover:text-madder">← BACK</button>
                  <button onClick={placeOrder} disabled={submitting} className="btn-primary disabled:opacity-50">
                    {submitting ? 'PLACING...' : `PLACE ORDER · ${formatINR(grand)}`}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Summary */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="bg-beige p-6">
              <p className="label text-madder mb-4">ORDER ({items.length})</p>
              <div className="space-y-4 max-h-72 overflow-y-auto pr-2">
                {items.map(i => (
                  <div key={`${i.productId}-${i.variantId || ''}`} className="flex gap-3">
                    <div className="w-14 h-16 bg-ivory overflow-hidden flex-shrink-0">
                      {i.product.images?.[0] && (
                        <Image src={i.product.images[0]} alt={i.product.name} width={56} height={64} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-sm truncate">{i.product.name}</p>
                      {i.variantLabel && <p className="font-ui text-[10px] text-mitti">{i.variantLabel}</p>}
                      <p className="font-ui text-xs text-mitti mt-1">Qty {i.quantity} · {formatINR(i.product.sellingPrice * i.quantity)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-mitti/20 mt-4 pt-4 space-y-2 font-ui text-sm">
                <Row label="Subtotal" value={formatINR(sub)} />
                {wrap > 0 && <Row label="Gift wrap" value={formatINR(wrap)} />}
                {couponCode && couponDiscount > 0 && <Row label={`Coupon · ${couponCode}`} value={`- ${formatINR(couponDiscount)}`} color="text-neem" />}
                <Row label="Shipping" value={shippingCost === 0 ? 'Free' : formatINR(shippingCost)} />
                <Row label="GST" value="Inclusive" small />
                {pointsToRedeem > 0 && (
                  <Row
                    label={`${pointsToRedeem.toLocaleString('en-IN')} points applied`}
                    value={`- ${formatINR(pointsValuePaise)}`}
                    color="text-madder"
                  />
                )}
              </div>
              {loyaltyPreview?.canRedeem && (
                <div className="mt-4 bg-banarasi/10 border border-banarasi/40 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="label text-madder">YOUR POINTS</p>
                    <p className="text-xs text-mitti">{loyaltyPreview.balance.toLocaleString('en-IN')} available</p>
                  </div>
                  {pointsToRedeem > 0 ? (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-kohl">{pointsToRedeem.toLocaleString('en-IN')} pts → {formatINR(pointsValuePaise)} off</span>
                      <button onClick={() => setPointsToRedeem(0)} className="text-madder text-xs tracking-widest">REMOVE</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setPointsToRedeem(loyaltyPreview.maxUsable)}
                      className="w-full text-xs tracking-widest bg-kohl text-ivory py-2 hover:bg-kohl/90"
                    >
                      APPLY {loyaltyPreview.maxUsable.toLocaleString('en-IN')} POINTS → {formatINR(loyaltyPreview.maxPaiseValue)} OFF
                    </button>
                  )}
                </div>
              )}
              <div className="border-t border-mitti/20 mt-4 pt-4 flex items-baseline justify-between">
                <span className="font-display text-lg">Total</span>
                <span className="font-display text-2xl">{formatINR(grand)}</span>
              </div>
            </div>
          </aside>
        </div>
      </section>
      <Footer />
    </>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder, inputMode, mono }: any) {
  return (
    <div className="mb-3">
      <label className="label text-mitti block mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        inputMode={inputMode}
        className={`w-full p-3 bg-ivory border border-mitti/20 font-ui text-sm focus:outline-none focus:border-madder ${mono ? 'font-mono' : ''}`} />
    </div>
  );
}

function ShippingOption({ value, current, onSelect, label, sub, price }: any) {
  return (
    <label className={`flex items-center justify-between p-4 cursor-pointer border ${current === value ? 'border-madder bg-ivory' : 'border-mitti/20 bg-beige'}`}>
      <div className="flex items-center gap-3">
        <input type="radio" checked={current === value} onChange={() => onSelect(value)} />
        <div>
          <p className="font-display text-base">{label}</p>
          <p className="font-italic italic text-mitti text-xs">{sub}</p>
        </div>
      </div>
      <span className="font-ui text-sm">{price === 0 ? 'FREE' : formatINR(price)}</span>
    </label>
  );
}

function PaymentOption({ value, current, onSelect, label, sub, disabled }: any) {
  return (
    <label className={`flex items-center gap-3 p-4 cursor-pointer border ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${current === value ? 'border-madder bg-ivory' : 'border-mitti/20 bg-beige'}`}>
      <input type="radio" checked={current === value} onChange={() => !disabled && onSelect(value)} disabled={disabled} />
      <div>
        <p className="font-display text-base">{label}</p>
        <p className="font-italic italic text-mitti text-xs">{sub}</p>
      </div>
    </label>
  );
}

function Row({ label, value, color, small }: any) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={small ? 'text-xs text-mitti' : 'text-kohl'}>{label}</span>
      <span className={`${color || 'text-kohl'} ${small ? 'text-xs' : ''}`}>{value}</span>
    </div>
  );
}
