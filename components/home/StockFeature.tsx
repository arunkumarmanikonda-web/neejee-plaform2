import Link from 'next/link';
import { TileAdd } from '@/components/product/TileAdd';
import { buildPricing } from '@/lib/catalog/pricing-read';
import { formatINR } from '@/lib/money';
import type { ProductCardData } from '@/components/product/ProductCard';
import styles from './StockFeature.module.css';

export function StockFeature({piece}:{piece:ProductCardData}) {
  return <section className={styles.feature} aria-label="Shop the featured piece">
    <Link href={'/products/'+encodeURIComponent(piece.slug)} className={styles.photo}>
      <img src={piece.images[0]} alt={piece.name} fetchPriority="high" decoding="async"/>
    </Link>
    <div className={styles.copy}><span>Found at Neejee</span>
      <h1>{piece.name}</h1>{piece.poeticLine && <p>{piece.poeticLine}</p>}
      <strong>{formatINR(buildPricing(piece).effectivePrice)}</strong>
      <TileAdd slug={piece.slug} name={piece.name}/>
      <Link href={'/products/'+encodeURIComponent(piece.slug)}>View piece details ↗</Link>
    </div>
  </section>;
}
