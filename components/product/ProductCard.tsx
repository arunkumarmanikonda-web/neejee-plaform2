'use client';
import Link from 'next/link';
import { Bookmark, Scan } from 'lucide-react';
import { useState } from 'react';
import { formatINR } from '@/lib/money';
import { buildPricing } from '@/lib/catalog/pricing-read';
import { useWishlist } from '@/lib/wishlist-store';
import { BadgeChipRow } from '@/components/ui/Badge';
import { studioHref } from '@/lib/studio';
import '@/components/shop/shop.css';

export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  poeticLine?: string | null;
  craft?: string | null;
  material?: string | null;
  region?: string | null;
  mrp: number;
  sellingPrice: number;
  salePrice?: number | null;
  saleStartsAt?: string | Date | null;
  saleEndsAt?: string | Date | null;
  images: string[];
  badges?: string[];
  inventory?: number | null;
  aiTryOnEligible?: boolean;
}
export function ProductCard({ product }: { product: ProductCardData }) {
  const { has, toggle } = useWishlist();
  const saved = has(product.id);
  const [detail,setDetail] = useState(false);
  const info = buildPricing(product);
  const cover = product.images[0];
  const second = product.images.find(img => img && img !== cover);
  const href = '/products/'+encodeURIComponent(product.slug);
  const descriptor = [...new Set([product.material, product.craft, product.region].filter(Boolean))].join(' · ');
  return <article className="nj-tile">
    <div className="nj-ticket"><h3><Link href={href}>{product.name}</Link></h3><span><strong>{formatINR(info.effectivePrice)}</strong>{info.mrp>info.effectivePrice && <del>{formatINR(info.mrp)}</del>}</span></div>
    <div className="nj-photo">
      <Link className="nj-image-open" href={href} aria-label={'View '+product.name}>{cover ? <img src={detail && second ? second : cover} alt={product.name+(detail?' · close view':'')} style={detail && !second ? {transform:'scale(1.9)'} : undefined} loading="lazy"/> : <span>View piece</span>}</Link>
      <div className="nj-live-badges">{info.salePrice && <span className="nj-stock">On sale</span>}<BadgeChipRow badges={product.badges}/>
        {product.inventory === 0 ? <span className="nj-stock">Sold out</span> : product.inventory != null && product.inventory <= 3 && <span className="nj-stock">Only {product.inventory} left</span>}</div>
      <button className="nj-save" aria-pressed={saved} aria-label={(saved?'Remove from wishlist: ':'Add to wishlist: ')+product.name} onClick={() => toggle(product.id,product.slug)}><Bookmark size={17} fill={saved?'currentColor':'none'}/></button>
      {cover && <button className="nj-detail-btn" aria-pressed={detail} onClick={() => setDetail(!detail)}><Scan size={14}/>{detail?'Main view':second?'Another view':'Look closer'}</button>}
    </div>
    <div className="nj-card-text">{descriptor && <p className="nj-overline">{descriptor}</p>}
      {product.poeticLine && <p className="nj-live-info line-clamp-1 mb-2">{product.poeticLine}</p>}
      <div className="nj-card-bottom"><Link href={href}>View piece ↗</Link></div>
      {product.aiTryOnEligible && <Link className="nj-text-link mt-2" href={studioHref('mirror',product.slug)}>Try in Aaina ↗</Link>}
    </div>
  </article>;
}
