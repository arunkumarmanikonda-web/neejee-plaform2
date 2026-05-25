'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useCart } from '@/lib/cart-store';
import { formatPrice } from '@/lib/data';

export default function CheckoutPage() {
  const { items, subtotal, giftWrap, clear } = useCart();
  const router = useRouter();
  const [placing, setPlacing] = useState(false);
  const [form, setForm] = useState({
    email: '', name: '', phone: '', line1: '', city: '', state: '', pincode: '', payment: 'UPI'
  });

  const total = subtotal();
  const shipping = total >= 250000 ? 0 : 15000;
  const grand = total + shipping;

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlacing(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: { email: form.email, name: form.name, phone: form.phone },
          address: { line1: form.line1, city: form.city, state: form.state, pincode: form.pincode, country: 'IN' },
          items: items.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.product.sellingPrice })),
          payment: form.payment,
          giftWrap,
          total: grand,
        }),
      });
      const data = await res.json();
      clear();
      router.push(`/order-confirmation?id=${data.orderNumber}`);
    } catch {
      alert('Something went wrong. Please try again.');
      setPlacing(false);
    }
  };

  if (items.length === 0) return (
    <>
      <Header />
      <div className="max-w-2xl mx-auto py-32 text-center">
        <p className="font-italic italic text-2xl text-mitti">Your trunk is empty.</p>
        <Link href="/" className="btn-primary inline-block mt-8">Begin Finding</Link>
      </div>
      <Footer />
    </>
  );

  return (
    <>
      <Header />
      <section className="max-w-8xl mx-auto px-6 lg:px-12 py-12">
        <h1 className="font-display text-4xl text-kohl text-center">Checkout</h1>
        <div className="madder-divider mx-auto mt-4 mb-12"></div>

        <form onSubmit={placeOrder} className="grid lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-8">
            <div>
              <p className="label text-madder mb-4">CONTACT</p>
              <input required type="email" placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="w-full p-3 bg-ivory border border-beige font-ui text-sm" />
            </div>

            <div>
              <p className="label text-madder mb-4">SHIPPING ADDRESS</p>
              <div className="space-y-3">
                <input required placeholder="Full name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="w-full p-3 bg-ivory border border-beige font-ui text-sm" />
                <input required placeholder="Phone" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="w-full p-3 bg-ivory border border-beige font-ui text-sm" />
                <input required placeholder="Street address" value={form.line1} onChange={e=>setForm({...form,line1:e.target.value})} className="w-full p-3 bg-ivory border border-beige font-ui text-sm" />
                <div className="grid grid-cols-3 gap-3">
                  <input required placeholder="City" value={form.city} onChange={e=>setForm({...form,city:e.target.value})} className="p-3 bg-ivory border border-beige font-ui text-sm" />
                  <input required placeholder="State" value={form.state} onChange={e=>setForm({...form,state:e.target.value})} className="p-3 bg-ivory border border-beige font-ui text-sm" />
                  <input required placeholder="Pincode" value={form.pincode} onChange={e=>setForm({...form,pincode:e.target.value})} className="p-3 bg-ivory border border-beige font-ui text-sm" />
                </div>
              </div>
            </div>

            <div>
              <p className="label text-madder mb-4">PAYMENT METHOD</p>
              <div className="space-y-2">
                {[
                  { id: 'UPI', label: 'UPI · GPay · PhonePe · BHIM' },
                  { id: 'CARD', label: 'Credit / Debit Card' },
                  { id: 'NB', label: 'Net Banking' },
                  { id: 'COD', label: 'Cash on Delivery' },
                ].map(p => (
                  <label key={p.id} className={`flex items-center gap-3 p-3 border cursor-pointer transition-colors ${form.payment===p.id?'border-madder bg-beige':'border-beige'}`}>
                    <input type="radio" name="payment" checked={form.payment===p.id} onChange={()=>setForm({...form,payment:p.id})} />
                    <span className="font-ui text-sm">{p.label}</span>
                  </label>
                ))}
              </div>
              <p className="label mt-4 text-monsoon">SECURED BY RAZORPAY · GST INVOICE INCLUDED</p>
            </div>
          </div>

          <aside className="bg-beige p-8 h-fit">
            <p className="label text-madder mb-6">YOUR TRUNK ({items.length})</p>
            <div className="space-y-3 max-h-64 overflow-y-auto mb-6">
              {items.map(i => (
                <div key={i.productId} className="flex gap-3">
                  <div className="w-14 h-16 bg-ivory relative flex-shrink-0">
                    {i.product.images[0] && <Image src={i.product.images[0]} alt="" fill className="object-cover" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-display text-sm text-kohl">{i.product.name}</p>
                    <p className="font-ui text-xs text-monsoon">Qty {i.quantity} · {formatPrice(i.product.sellingPrice * i.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2 font-ui text-sm border-t border-mitti/20 pt-4">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatPrice(total)}</span></div>
              <div className="flex justify-between"><span>Shipping</span><span>{shipping === 0 ? 'FREE' : formatPrice(shipping)}</span></div>
              <div className="flex justify-between text-monsoon text-xs"><span>GST</span><span>Included</span></div>
            </div>
            <div className="border-t border-mitti/20 pt-4 mt-4 flex justify-between">
              <span className="font-display text-lg">Total</span>
              <span className="font-display text-2xl text-kohl">{formatPrice(grand)}</span>
            </div>
            <button type="submit" disabled={placing} className="btn-primary w-full mt-6 disabled:opacity-60">
              {placing ? 'PLACING ORDER...' : `PLACE ORDER · ${formatPrice(grand)}`}
            </button>
            <p className="label mt-4 text-monsoon text-center">FOUNDER&apos;S NOTE + AUTHENTICITY CARD INCLUDED</p>
          </aside>
        </form>
      </section>
      <Footer />
    </>
  );
}
