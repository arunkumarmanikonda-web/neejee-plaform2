'use client';
// Live, API-backed cross-sell. Renders nothing if no pairings found.
import { useEffect, useState } from 'react';
import { ProductCard, type ProductCardData } from './ProductCard';

interface Props {
  productId: string;
  limit?: number;
}

export function CompleteTheLook({ productId, limit = 4 }: Props) {
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [label, setLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId) return;
    fetch(`/api/recommendations?productId=${productId}&limit=${limit}`)
      .then(r => r.json())
      .then(d => {
        setProducts(d.products || []);
        setLabel(d.label || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [productId, limit]);

  if (loading || products.length === 0) return null;

  return (
    <section className="bg-beige/30 py-12 px-6 mt-12">
      <div className="max-w-7xl mx-auto">
        <p className="label text-madder">COMPLETE THE LOOK</p>
        <h2 className="font-display text-3xl md:text-4xl text-kohl mt-2">{label || 'Pairs beautifully with'}</h2>
        <p className="font-italic italic text-mitti text-sm mt-2">Personally paired by Nidhi.</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mt-8">
          {products.slice(0, limit).map(p => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
