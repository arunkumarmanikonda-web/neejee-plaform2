'use client';

// Catalogue-backed cross-sell. On PDP it uses the viewed product; on cart it uses
// the complete basket so recommendations fill gaps instead of repeating what is selected.
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ProductCard, type ProductCardData } from './ProductCard';
import { useCart } from '@/lib/cart-store';

interface Props {
  productId: string;
  limit?: number;
}

export function CompleteTheLook({ productId, limit = 4 }: Props) {
  const pathname = usePathname();
  const cartItems = useCart(state => state.items);
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [label, setLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const seedIds = useMemo(() => {
    const isCart = pathname === '/cart' || pathname?.startsWith('/cart/');
    if (!isCart) return productId ? [productId] : [];

    const basketIds = Array.from(new Set(cartItems.map(item => item.productId).filter(Boolean)));
    return basketIds.length > 0 ? basketIds : (productId ? [productId] : []);
  }, [pathname, cartItems, productId]);

  const requestKey = seedIds.join(',');

  useEffect(() => {
    if (!requestKey) {
      setProducts([]);
      setLabel(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({
      limit: String(limit),
      productIds: requestKey,
    });

    fetch(`/api/recommendations?${params.toString()}`, { cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('recommendations unavailable')))
      .then(data => {
        if (cancelled) return;
        setProducts(Array.isArray(data.products) ? data.products : []);
        setLabel(data.label || null);
      })
      .catch(() => {
        if (cancelled) return;
        setProducts([]);
        setLabel(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [requestKey, limit]);

  if (loading || products.length === 0) return null;

  const basketAware = seedIds.length > 1;

  return (
    <section className="bg-beige/30 py-12 px-6 mt-12">
      <div className="max-w-7xl mx-auto">
        <p className="label text-madder">{basketAware ? 'COMPLETE YOUR TRUNK' : 'COMPLETE THE LOOK'}</p>
        <h2 className="font-display text-3xl md:text-4xl text-kohl mt-2">
          {label || (basketAware ? 'What would complete this edit' : 'Pairs beautifully with')}
        </h2>
        <p className="font-italic italic text-mitti text-sm mt-2">
          {basketAware
            ? 'Chosen around what is already in your trunk.'
            : 'Curated to sit naturally with this piece.'}
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mt-8">
          {products.slice(0, limit).map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
