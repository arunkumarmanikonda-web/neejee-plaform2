import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductCard } from '@/components/product/ProductCard';
import { AddToCartButton } from '@/components/product/AddToCartButton';
import { getProductBySlug, getRelatedProducts, formatPrice } from '@/lib/data';

export default function ProductPage({ params }: { params: { slug: string } }) {
  const product = getProductBySlug(params.slug);
  if (!product) notFound();
  const related = getRelatedProducts(product);
  const discount = Math.round(((product.mrp - product.sellingPrice) / product.mrp) * 100);

  return (
    <>
      <Header />
      <nav className="max-w-8xl mx-auto px-6 lg:px-12 pt-8 font-ui text-xs tracking-widest text-monsoon">
        <Link href="/">HOME</Link> / <Link href={`/categories/${product.categorySlug}`}>{product.categorySlug.toUpperCase()}</Link> / <span className="text-kohl">{product.name.toUpperCase()}</span>
      </nav>

      <section className="max-w-8xl mx-auto px-6 lg:px-12 py-12 grid lg:grid-cols-2 gap-12">
        <div>
          <div className="aspect-[4/5] bg-beige relative overflow-hidden">
            {product.images[0] && (
              <Image src={product.images[0]} alt={product.name} fill priority className="object-cover" />
            )}
          </div>
        </div>

        <div>
          <div className="flex gap-2 flex-wrap mb-4">
            {product.badges.map(b => <span key={b} className="badge-founder">{b}</span>)}
          </div>
          <p className="label text-mitti mb-2">{product.craft.toUpperCase()} · {product.region.toUpperCase()}</p>
          <h1 className="font-display text-4xl md:text-5xl text-kohl leading-tight">{product.name}</h1>
          <p className="font-italic italic text-xl text-mitti mt-4">{product.poeticLine}</p>
          <div className="madder-divider mt-6"></div>

          <div className="mt-6 flex items-baseline gap-3">
            <span className="font-display text-3xl text-kohl">{formatPrice(product.sellingPrice)}</span>
            {discount > 0 && (
              <>
                <span className="font-ui text-base text-monsoon line-through">{formatPrice(product.mrp)}</span>
                <span className="font-ui text-base text-madder">-{discount}%</span>
              </>
            )}
          </div>
          <p className="label mt-2">INCLUSIVE OF ALL TAXES · FREE SHIPPING ABOVE ₹2,500</p>

          <AddToCartButton product={product} />

          {product.aiTryOnEligible && (
            <Link href={`/ai/mirror?product=${product.slug}`} className="mt-4 flex items-center gap-3 font-ui text-sm tracking-wider text-madder hover:text-mitti transition-colors">
              <span>✦</span> TRY WITH NEEJEE MIRROR <span className="text-monsoon text-xs">(AI try-on)</span>
            </Link>
          )}

          <div className="mt-10 space-y-6">
            <div>
              <p className="label text-madder mb-2">CRAFT STORY</p>
              <p className="font-body text-base text-kohl/85 leading-relaxed">{product.description}</p>
            </div>
            <div>
              <p className="label text-madder mb-2">THE ARTISAN</p>
              <p className="font-body text-base text-kohl/85"><span className="font-display italic">{product.artisanName}</span> — {product.region}</p>
            </div>
            <div>
              <p className="label text-madder mb-2">MATERIAL · OCCASION</p>
              <p className="font-body text-base text-kohl/85">{product.material} · {product.occasion}</p>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-beige grid grid-cols-3 gap-3 text-center">
            <div><p className="label text-mitti">FREE SHIPPING</p><p className="font-ui text-[10px] text-monsoon mt-1">PAN INDIA</p></div>
            <div><p className="label text-mitti">7-DAY RETURNS</p><p className="font-ui text-[10px] text-monsoon mt-1">EASY EXCHANGE</p></div>
            <div><p className="label text-mitti">COD AVAILABLE</p><p className="font-ui text-[10px] text-monsoon mt-1">SELECT PINCODES</p></div>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="py-20 bg-beige/40">
          <div className="max-w-8xl mx-auto px-6 lg:px-12">
            <div className="text-center mb-12">
              <p className="label text-madder mb-3">STYLE IT WITH</p>
              <h2 className="font-display text-4xl text-kohl">Complete the look</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {related.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </>
  );
}
