'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart-store';
import type { Product } from '@/lib/data';
import { Check, Plus, Minus } from 'lucide-react';

export function AddToCartButton({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const router = useRouter();

  const handleAdd = () => {
    addItem(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = () => {
    addItem(product, qty);
    router.push('/checkout');
  };

  const inStock = product.inventory > 0;

  return (
    <div className="mt-8 space-y-3">
      <div className="flex items-center gap-4">
        <div className="flex items-center border border-mitti/20">
          <button onClick={() => setQty(Math.max(1, qty - 1))} className="p-3 hover:bg-beige" aria-label="Decrease quantity">
            <Minus className="w-3 h-3" />
          </button>
          <span className="px-6 font-ui text-sm w-12 text-center">{qty}</span>
          <button onClick={() => setQty(Math.min(product.inventory, qty + 1))} className="p-3 hover:bg-beige" aria-label="Increase quantity">
            <Plus className="w-3 h-3" />
          </button>
        </div>
        <p className="font-italic italic text-mitti text-sm">
          {inStock ? (product.inventory <= 3 ? `Only ${product.inventory} left — found personally` : 'In your trunk in 30 seconds') : 'Sold out'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={handleAdd} disabled={!inStock} className="btn-outline disabled:opacity-50 disabled:cursor-not-allowed">
          {added ? (<><Check className="w-3 h-3 inline mr-1" /> ADDED</>) : 'ADD TO TRUNK'}
        </button>
        <button onClick={handleBuyNow} disabled={!inStock} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
          BUY NOW
        </button>
      </div>
    </div>
  );
}
