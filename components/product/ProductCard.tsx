'use client';
import Link from 'next/link';
import Image from 'next/image';
import { Heart } from 'lucide-react';
import type { Product } from '@/lib/data';
import { formatPrice } from '@/lib/utils';
import { useState } from 'react';

export function ProductCard({ product }: { product: Product }) {
  const [wishlisted, setWishlisted] = useState(false);
  const discount = product.mrp > product.sellingPrice ? Math.round(((product.mrp - product.sellingPrice) / product.mrp) * 100) : 0;

  return (
    <div className="group">
      <Link href={`/products/${product.slug}`} className="block">
        <div className="aspect-[3/4] bg-beige relative overflow-hidden">
          {product.images[0] && (
            <Image
              src={product.images[0]}
              alt={product.name}
              fill
              sizes="(min-width:1024px) 33vw, 50vw"
              className="object-cover group-hover:scale-105 transition-transform duration-700"
            />
          )}
          {product.badges.length > 0 && (
            <div className="absolute top-3 left-3 flex flex-col gap-1">
              {product.badges.slice(0, 2).map(b => (
                <span key={b} className="badge-founder">{b}</span>
              ))}
            </div>
          )}
          {product.inventory <= 3 && product.inventory > 0 && (
            <span className="absolute bottom-3 left-3 badge-founder bg-haldi text-kohl">ONLY {product.inventory} LEFT</span>
          )}
          {product.aiTryOnEligible && (
            <span className="absolute top-3 right-3 bg-kohl/80 text-ivory text-[9px] px-2 py-1 font-ui tracking-widest">✦ MIRROR</span>
          )}
          <button
            onClick={(e) => { e.preventDefault(); setWishlisted(!wishlisted); }}
            className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-ivory/90 hover:bg-ivory flex items-center justify-center transition-colors"
            aria-label="Add to wishlist"
          >
            <Heart className={`w-4 h-4 ${wishlisted ? 'fill-madder text-madder' : 'text-kohl'}`} />
          </button>
        </div>
        <div className="mt-3">
          <p className="label text-mitti">{product.craft.toUpperCase()} · {product.region.toUpperCase()}</p>
          <h3 className="font-display text-lg text-kohl mt-1 group-hover:text-madder transition-colors">{product.name}</h3>
          <p className="font-italic italic text-mitti text-sm mt-1 line-clamp-1">{product.poeticLine}</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-display text-lg text-kohl">{formatPrice(product.sellingPrice)}</span>
            {discount > 0 && (
              <>
                <span className="font-ui text-xs text-monsoon line-through">{formatPrice(product.mrp)}</span>
                <span className="font-ui text-xs text-madder">-{discount}%</span>
              </>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
