'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Bookmark } from 'lucide-react';
import { TileGallery, catalogueViews } from './TileGallery';
import { TileAdd } from './TileAdd';
import ticket from '@/components/shop/PieceTicket.module.css';
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
  shortName?: string | null;
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
  buyable?: boolean;
}
export function ProductCard({ product, closeUp = false }: { product: ProductCardData; closeUp?: boolean }) {
  const { has, toggle } = useWishlist();
  const saved = has(product.id);
  const info = buildPricing(product);
  const views = catalogueViews(product.images);
  const href = '/products/'+encodeURIComponent(product.slug);
  const location = [...new Set([product.region, product.state].filter(Boolean))].join(', ');
  const story = product.poeticLine?.trim();
  const alias = product.shortName?.trim();
  const label = alias && !product.name.toLowerCase().includes(alias.toLowerCase()) ? alias : location;
  const descriptor = [...new Set([(product.colours || []).slice(0,2).join(' / '), product.craft || product.technique, product.material, label!==location ? location : ''].filter(Boolean))].join(' · ');
  return <article className="nj-tile loom-card">
    <TileGallery autoCount={closeUp ? 0 : new Set(product.images.filter(Boolean)).size} detailView={views.length>1 ? {index:views.length-1,label:'Closer view'} : undefined} initialView={closeUp ? Math.max(0, views.length-1) : 0} name={product.name} views={views} href={href}>
      <div className="nj-live-badges">{info.salePrice && <span className="nj-stock">On sale</span>}<BadgeChipRow badges={product.badges}/>
        {product.inventory === 0 ? <span className="nj-stock">Sold out</span> : product.inventory != null && product.inventory <= 3 && <span className="nj-stock">Only {product.inventory} left</span>}</div>
      <button className="nj-save" aria-pressed={saved} aria-label={(saved?'Remove from wishlist: ':'Add to wishlist: ')+product.name} onClick={() => toggle(product.id,product.slug)}><Bookmark size={17} fill={saved?'currentColor':'none'}/></button>
    </TileGallery>
    <div className="loom-ticket">
      <div className={ticket.label}>
        {label && <span>{label}</span>}
        <div className={ticket.livePrice}><strong>{formatINR(info.effectivePrice)}</strong>{info.mrp>info.effectivePrice && <del>{formatINR(info.mrp)}</del>}</div>
      </div>
      <h3 className={ticket.name}><Link href={href}>{product.name}</Link></h3>
      {story && <p className={ticket.caption}>{story}</p>}
      {descriptor && descriptor!==story && <p className="loom-spec">{descriptor}</p>}
      <div className="loom-actions"><TileAdd slug={product.slug} name={product.name} soldOut={product.inventory===0}/>
        <Link className="loom-detail" href={href}>Details</Link>
        {product.aiTryOnEligible && <Link className="loom-detail" href={studioHref('mirror',product.slug)}>Aaina</Link>}
      </div>
    </div>
  </article>;
}


export function CatalogueGrid({ products, textiles }: { products: ProductCardData[]; textiles: boolean }) {
  const [closeUp, setCloseUp] = useState(false);
  return <>
    <div className="loom-tools">
      <div className="loom-presentation" role="group" aria-label="Collection photographs">
        <button type="button" aria-pressed={!closeUp} onClick={() => setCloseUp(false)}>Full view</button>
        <button type="button" aria-pressed={closeUp} onClick={() => setCloseUp(true)}>{textiles ? 'Fabric close-up' : 'See the details'}</button>
      </div>
    </div>
    <div className="nj-grid">{products.map(product => <ProductCard key={product.id} product={product} closeUp={closeUp}/>)}</div>
  </>;
}
