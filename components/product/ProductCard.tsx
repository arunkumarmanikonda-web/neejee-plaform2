'use client';
import Link from 'next/link';
import Image from 'next/image';
import { Heart } from 'lucide-react';
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
  const hoverImg = product.images?.[1];

  return (
    <article className="group min-w-0">
      <div className="relative bg-[#efe6d8] overflow-hidden">
        <Link href={`/products/${product.slug}`} className="block">
          <div className="aspect-[4/3] bg-beige relative overflow-hidden">
            {img ? (
              <>
                <Image
                  src={img}
                  alt={product.name}
                  fill
                  sizes="(min-width:1280px) 28vw, (min-width:768px) 33vw, 50vw"
                  className={`object-cover transition-all duration-700 ease-out ${hoverImg ? 'group-hover:opacity-0 group-hover:scale-[1.01]' : 'group-hover:scale-[1.018]'}`}
                />
                {hoverImg && (
                  <Image
                    src={hoverImg}
                    alt=""
                    aria-hidden="true"
                    fill
                    sizes="(min-width:1280px) 28vw, (min-width:768px) 33vw, 50vw"
                    className="object-cover opacity-0 scale-[1.015] transition-all duration-700 ease-out group-hover:opacity-100 group-hover:scale-100"
                  />
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center px-5 text-center text-mitti/55 font-display italic text-sm">
                Image being prepared
              </div>
            )}

            <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5 max-w-[72%]">
              {eff.onSale && <span className="badge-founder">ON SALE</span>}
              <BadgeChipRow badges={product.badges} />
            </div>

            {product.aiTryOnEligible && (
              <span className="absolute bottom-3 left-3 border border-ivory/65 bg-kohl/58 backdrop-blur-sm text-ivory text-[8px] px-2.5 py-1 font-ui tracking-[0.18em]">MIRROR ✦</span>
            )}

            {product.inventory != null && product.inventory <= 3 && product.inventory > 0 && (
              <span className="absolute bottom-3 right-3 bg-ivory/88 text-madder px-2.5 py-1 font-ui text-[8px] tracking-[0.16em]">ONLY {product.inventory} LEFT</span>
            )}
            {product.inventory === 0 && (
              <span className="absolute bottom-3 right-3 bg-kohl/72 text-ivory px-2.5 py-1 font-ui text-[8px] tracking-[0.16em]">SOLD OUT</span>
            )}
          </div>
        </Link>

        <button
          onClick={() => toggle(product.id, product.slug)}
          className="absolute top-3 right-3 z-10 w-9 h-9 flex items-center justify-center text-kohl bg-ivory/72 backdrop-blur-[2px] transition-all hover:bg-ivory hover:text-madder"
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          aria-pressed={wishlisted}
        >
          <Heart className={`w-[18px] h-[18px] ${wishlisted ? 'fill-madder text-madder' : ''}`} strokeWidth={1.25} />
        </button>
      </div>

      <Link href={`/products/${product.slug}`} className="block pt-3 pb-1">
        <div className="min-w-0">
          <h3 className="font-display text-[17px] md:text-[19px] leading-[1.15] uppercase tracking-[0.025em] text-kohl group-hover:text-madder transition-colors line-clamp-2">
            {product.name}
          </h3>
          {(product.craft || product.region) && (
            <p className="font-display text-[13px] md:text-[14px] text-mitti mt-1.5 line-clamp-1">
              {[product.region, product.craft].filter(Boolean).join(' · ')}
            </p>
          )}
          {product.poeticLine && (
            <p className="font-display italic text-mitti/80 text-[13px] mt-1 line-clamp-1">{product.poeticLine}</p>
          )}
        </div>

        <div className="flex items-baseline gap-2 mt-2 flex-wrap">
          <span className={`font-display text-[17px] md:text-[18px] ${eff.onSale ? 'text-madder' : 'text-kohl'}`}>
            {formatINR(eff.price)}
          </span>
          {eff.onSale && (
            <span className="font-ui text-[9px] text-monsoon line-through">{formatINR(product.sellingPrice)}</span>
          )}
          {!eff.onSale && product.mrp > product.sellingPrice && (
            <span className="font-ui text-[9px] text-monsoon line-through">{formatINR(product.mrp)}</span>
          )}
          {dp > 0 && <span className="font-ui text-[8px] tracking-[0.12em] text-madder">{dp}% OFF</span>}
        </div>
      </Link>
    </article>
  );
}
