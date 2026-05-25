'use client';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useCart } from '@/lib/cart-store';
import { formatPrice } from '@/lib/data';
import { Minus, Plus, X } from 'lucide-react';

export default function CartPage() {
  const { items, subtotal, updateQuantity, removeItem, giftWrap, setGiftWrap, personalNote, setPersonalNote } = useCart();
  const total = subtotal();
  const freeShippingThreshold = 250000;
  const remaining = Math.max(0, freeShippingThreshold - total);

  return (
    <>
      <Header />
      <section className="max-w-8xl mx-auto px-6 lg:px-12 py-12">
        <nav className="font-ui text-xs tracking-widest text-monsoon mb-8">
          <Link href="/">HOME</Link> / <span className="text-kohl">YOUR TRUNK</span>
        </nav>

        <h1 className="font-display text-5xl text-kohl">Your trunk.</h1>
        <p className="font-italic italic text-xl text-mitti mt-3">Personally folded. Ready for the road.</p>
        <div className="madder-divider mt-6"></div>

        {items.length === 0 ? (
          <div className="text-center py-32">
            <p className="font-italic italic text-2xl text-mitti">Your trunk is empty.</p>
            <Link href="/" className="btn-primary inline-block mt-8">Begin Finding</Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-12 mt-12">
            <div className="lg:col-span-2 space-y-6">
              {items.map(item => (
                <div key={item.productId} className="flex gap-4 border-b border-beige pb-6">
                  <div className="w-28 h-32 bg-beige relative flex-shrink-0">
                    {item.product.images[0] && (
                      <Image src={item.product.images[0]} alt={item.product.name} fill className="object-cover" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="label text-mitti">{item.product.craft.toUpperCase()} · {item.product.region.toUpperCase()}</p>
                    <h3 className="font-display text-xl text-kohl mt-1">{item.product.name}</h3>
                    <p className="font-italic italic text-mitti text-sm mt-1">{item.product.poeticLine}</p>
                    <div className="flex items-center gap-6 mt-4">
                      <div className="flex items-center border border-beige">
                        <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="p-2 hover:bg-beige"><Minus className="w-3 h-3" /></button>
                        <span className="px-4 font-ui text-sm">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="p-2 hover:bg-beige"><Plus className="w-3 h-3" /></button>
                      </div>
                      <button onClick={() => removeItem(item.productId)} className="font-ui text-xs tracking-widest text-monsoon hover:text-madder">REMOVE</button>
                    </div>
                  </div>
                  <p className="font-display text-xl text-kohl">{formatPrice(item.product.sellingPrice * item.quantity)}</p>
                </div>
              ))}
            </div>

            <aside className="bg-beige p-8 h-fit sticky top-28">
              {remaining > 0 ? (
                <div className="mb-6 p-4 bg-ivory border-l-2 border-madder">
                  <p className="label text-madder">FREE SHIPPING</p>
                  <p className="font-italic italic text-sm text-kohl mt-1">Add {formatPrice(remaining)} more for free shipping.</p>
                </div>
              ) : (
                <div className="mb-6 p-4 bg-neem/10 border-l-2 border-neem">
                  <p className="label text-neem">FREE SHIPPING UNLOCKED ✓</p>
                </div>
              )}

              <label className="flex items-center gap-3 mb-4 cursor-pointer">
                <input type="checkbox" checked={giftWrap} onChange={e => setGiftWrap(e.target.checked)} />
                <span className="font-ui text-xs tracking-widest text-kohl">GIFT WRAP THE SANDOOK (+₹150)</span>
              </label>

              <textarea
                placeholder="Personal note (printed inside Sandook)"
                value={personalNote}
                onChange={e => setPersonalNote(e.target.value)}
                className="w-full p-3 bg-ivory border border-beige font-italic italic text-sm text-kohl resize-none"
                rows={3}
              />

              <div className="mt-6 space-y-2 font-ui text-sm">
                <div className="flex justify-between text-kohl"><span>Subtotal</span><span>{formatPrice(total - (giftWrap ? 15000 : 0))}</span></div>
                {giftWrap && <div className="flex justify-between text-kohl"><span>Gift wrap</span><span>{formatPrice(15000)}</span></div>}
                <div className="flex justify-between text-monsoon"><span>Shipping</span><span>{remaining > 0 ? formatPrice(15000) : 'FREE'}</span></div>
                <div className="flex justify-between text-monsoon text-xs"><span>GST</span><span>Included</span></div>
              </div>
              <div className="border-t border-mitti/20 pt-4 mt-4">
                <div className="flex justify-between items-baseline">
                  <span className="font-display text-xl text-kohl">Total</span>
                  <span className="font-display text-3xl text-kohl">{formatPrice(total + (remaining > 0 ? 15000 : 0))}</span>
                </div>
              </div>
              <Link href="/checkout" className="btn-primary block text-center mt-6">PROCEED TO CHECKOUT</Link>
              <Link href="/" className="block text-center mt-3 font-ui text-xs tracking-widest text-mitti hover:text-kohl">CONTINUE SHOPPING →</Link>
            </aside>
          </div>
        )}
      </section>
      <Footer />
    </>
  );
}
