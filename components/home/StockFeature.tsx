import Link from 'next/link';
import { TileGallery } from '@/components/product/TileGallery';
import { TileAdd } from '@/components/product/TileAdd';
import { buildPricing } from '@/lib/catalog/pricing-read';
import { formatINR } from '@/lib/money';
import type { ProductCardData } from '@/components/product/ProductCard';
import styles from './StockFeature.module.css';

export function StockFeature({piece,home}:{piece:ProductCardData;home:boolean}) {
  const views = [...new Set(piece.images.filter(Boolean))].map((src, i) => ({src, label: i ? 'Photo '+(i+1) : 'Full view'}));
  return <section className={styles.feature} aria-label={home?"Home & objects":"More from Neejee"}>
    <div className={styles.photo}>
      <TileGallery name={piece.name} views={views} autoCount={views.length} eager href={'/products/'+encodeURIComponent(piece.slug)}/>
    </div>
    <div className={styles.copy}><span>{home?<Link href="/edits/home">Home &amp; objects</Link>:"More from Neejee"}</span>
      <h2>{piece.name}</h2>{piece.poeticLine && <p>{piece.poeticLine}</p>}
      <strong>{formatINR(buildPricing(piece).effectivePrice)}</strong>
      <TileAdd slug={piece.slug} name={piece.name}/>
      <Link href={'/products/'+encodeURIComponent(piece.slug)}>View piece details ↗</Link>
    </div>
  </section>;
}
