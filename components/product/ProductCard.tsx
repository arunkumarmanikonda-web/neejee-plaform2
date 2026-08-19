'use client';
import Link from 'next/link';
import Image from 'next/image';
import { Heart } from 'lucide-react';
import { useState } from 'react';
import { formatINR, effectivePricePaise, discountPct } from '@/lib/money';
import { useWishlist } from '@/lib/wishlist-store';
import { BadgeChipRow } from '@/components/ui/Badge';

export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  poeticLine?: string | null;
  craft?: string | null;
  region?: string | null;
  mrp: number;
  sellingPrice: number;
  salePrice?: number | null;
  saleStartsAt?: string | Date | null;
  saleEndsAt?: string | Date | null;
  images: string[];
  badges?: string[];
  inventory?: number;
  aiTryOnEligible?: boolean;
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const { has, toggle } = useWishlist();
  const wishlisted = has(product.id);
  const eff = effectivePricePaise(product.sellingPrice, product.salePrice, product.saleStartsAt, product.saleEndsAt);
  const dp = discountPct(product.mrp, eff.price);
  const img = product.images?.[0];

  return (
    <div className="group">
      <Link href={`/products/${product.slug}`} className="block">
        <div className="aspect-[3/4] bg-beige relative overflow-hidden">
          {img ? (
            <Image
              src={img}
              alt={product.name}
              fill
              sizes="(min-width:1024px) 33vw, 50vw"
              className="object-cover group-hover:scale-105 transition-transform duration-700"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-mitti/50 font-italic italic">
              No image
            </div>
          )}

          {/* Top-left badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1">
            {eff.onSale && <span className="badge-founder">ON SALE</span>}
            <BadgeChipRow badges={product.badges} />
          </div>

          {/* Top-right: Mirror eligibility */}
          {product.aiTryOnEligible && (
            <span className="absolute top-3 right-3 bg-kohl/80 text-ivory text-[9px] px-2 py-1 font-ui tracking-widest">✦ MIRROR</span>
          )}

          {/* Bottom-left: low stock indicator */}
          {product.inventory != null && product.inventory <= 3 && product.inventory > 0 && (
            <span className="absolute bottom-3 left-3 badge-founder bg-haldi text-kohl">ONLY {product.inventory} LEFT</span>
          )}
          {product.inventory === 0 && (
            <span className="absolute bottom-3 left-3 badge-founder bg-monsoon">SOLD OUT</span>
          )}

          {/* Wishlist */}
          <button
            onClick={(e) => { e.preventDefault(); toggle(product.id, product.slug); }}
            className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-ivory/90 hover:bg-ivory flex items-center justify-center transition-colors"
            aria-label="Add to wishlist"
          >
            <Heart className={`w-4 h-4 ${wishlisted ? 'fill-madder text-madder' : 'text-kohl'}`} />
          </button>
        </div>

        <div className="mt-3">
          {(product.craft || product.region) && (
            <p className="label text-mitti">
              {[product.craft, product.region].filter(Boolean).join(' · ').toUpperCase()}
            </p>
          )}
          <h3 className="font-display text-lg text-kohl mt-1 group-hover:text-madder transition-colors">
            {product.name}
          </h3>
          {product.poeticLine && (
            <p className="font-italic italic text-mitti text-sm mt-1 line-clamp-1">{product.poeticLine}</p>
          )}
          <div className="flex items-baseline gap-2 mt-2 flex-wrap">
            <span className={`font-display text-lg ${eff.onSale ? 'text-madder' : 'text-kohl'}`}>
              {formatINR(eff.price)}
            </span>
            {eff.onSale && (
              <span className="font-ui text-xs text-monsoon line-through">{formatINR(product.sellingPrice)}</span>
            )}
            {!eff.onSale && product.mrp > product.sellingPrice && (
              <span className="font-ui text-xs text-monsoon line-through">{formatINR(product.mrp)}</span>
            )}
            {dp > 0 && (
              <span className="font-ui text-xs text-madder">-{dp}%</span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
