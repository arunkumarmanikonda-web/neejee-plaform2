'use client';
import Link from 'next/link';
import { Bookmark } from 'lucide-react';
import { TileGallery, catalogueViews } from './TileGallery';
import { TileAdd } from './TileAdd';
import { formatINR } from '@/lib/money';
import { buildPricing } from '@/lib/catalog/pricing-read';
import { useWishlist } from '@/lib/wishlist-store';
import { BadgeChipRow } from '@/components/ui/Badge';
import { studioHref } from '@/lib/studio';
import '@/components/shop/shop.css';
import './merchandise.css';

export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  poeticLine?: string | null;
  craft?: string | null;
  material?: string | null;
  technique?: string | null;
  colours?: string[];
  state?: string | null;
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
  const info = buildPricing(product);
  const views = catalogueViews(product.images);
  const href = '/products/'+encodeURIComponent(product.slug);
  const descriptor = [...new Set([(product.colours||[]).slice(0,2).join(' / '),product.craft,product.technique, product.material, [product.region,product.state].filter(Boolean).join(', ')].filter(Boolean))].join(' · ');
  return <article className="nj-tile">
    <TileGallery name={product.name} views={views} href={href}>
      <div className="nj-live-badges">{info.salePrice && <span className="nj-stock">On sale</span>}<BadgeChipRow badges={product.badges}/>
        {product.inventory === 0 ? <span className="nj-stock">Sold out</span> : product.inventory != null && product.inventory <= 3 && <span className="nj-stock">Only {product.inventory} left</span>}</div>
      <button className="nj-save" aria-pressed={saved} aria-label={(saved?'Remove from wishlist: ':'Add to wishlist: ')+product.name} onClick={() => toggle(product.id,product.slug)}><Bookmark size={17} fill={saved?'currentColor':'none'}/></button>
    </TileGallery>
    <div className="nj-ticket"><h3><Link href={href}>{product.name}</Link></h3><span><strong>{formatINR(info.effectivePrice)}</strong>{info.mrp>info.effectivePrice && <del>{formatINR(info.mrp)}</del>}</span></div>
    <div className="nj-card-text">{descriptor && <p className="nj-overline">{descriptor}</p>}
      {product.poeticLine && <p className="nj-live-info line-clamp-1 mb-2">{product.poeticLine}</p>}
      <div className="nj-tile-actions"><TileAdd slug={product.slug} name={product.name} soldOut={product.inventory===0}/><Link className="nj-piece-link" href={href}>Details</Link></div>
      {product.aiTryOnEligible && <Link className="nj-text-link mt-2" href={studioHref('mirror',product.slug)}>Try in Aaina ↗</Link>}
    </div>
  </article>;
}
