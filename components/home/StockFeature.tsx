import Link from 'next/link';
import { TileAdd } from '@/components/product/TileAdd';
import { buildPricing } from '@/lib/catalog/pricing-read';
import { formatINR } from '@/lib/money';
import type { ProductCardData } from '@/components/product/ProductCard';
import styles from './StockFeature.module.css';

export function StockFeature({piece,home}:{piece:ProductCardData;home:boolean}) {
  return <section className={styles.feature} aria-label={home?"Home & objects":"More from Neejee"}>
    <Link href={'/products/'+encodeURIComponent(piece.slug)} className={styles.photo}>
      <img src={piece.images[0]} alt={piece.name} loading="lazy" decoding="async"/>
    </Link>
    <div className={styles.copy}><span>{home?<Link href="/edits/home">Home &amp; objects</Link>:"More from Neejee"}</span>
      <h2>{piece.name}</h2>{piece.poeticLine && <p>{piece.poeticLine}</p>}
      <strong>{formatINR(buildPricing(piece).effectivePrice)}</strong>
      <TileAdd slug={piece.slug} name={piece.name}/>
      <Link href={'/products/'+encodeURIComponent(piece.slug)}>View piece details ↗</Link>
    </div>
  </section>;
}
