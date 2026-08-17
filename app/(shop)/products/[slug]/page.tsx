'use client';
import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Heart, Sparkles, Truck, RotateCcw, ShieldCheck, Plus, Minus, ChevronDown, Check } from 'lucide-react';
import { formatINR, effectivePricePaise, discountPct } from '@/lib/money';
import { isPreorder, isSoldOut, fulfilmentStatusLine, buyCtaLabel, checkoutPaise } from '@/lib/fulfilment';
import { useCart } from '@/lib/cart-store';
import { WaitlistSignup } from '@/components/product/WaitlistSignup';
import { ReviewsSection } from '@/components/product/ReviewsSection';
import { BadgeRow } from '@/components/ui/Badge';
import { track } from '@/lib/analytics';
import { CompleteTheLook } from '@/components/product/CompleteTheLook';

export const dynamic = 'force-dynamic';

function PDPInner() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const { addItem } = useCart();

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeImage, setActiveImage] = useState(0);
  const [activeVariant, setActiveVariant] = useState<any>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [openTab, setOpenTab] = useState<string>('craft');

  useEffect(() => {
    if (!slug) return;
    setLoading(true); setError('');
    fetch(`/api/products/${slug}`).then(r => r.json()).then(d => {
      if (d.error) { setError(d.error); return; }
      setProduct(d.product);
      // Pick first in-stock variant
      const firstInStock = d.product.variants?.find((v: any) => v.inStock) || d.product.variants?.[0];
      setActiveVariant(firstInStock);
      // Track PDP view
      track({ type: 'PRODUCT_VIEW', productId: d.product.id, value: d.product.sellingPrice });
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <><Header /><div className="max-w-8xl mx-auto px-6 py-20 text-mitti">Loading...</div><Footer /></>;
  if (error || !product) return <><Header /><div className="max-w-8xl mx-auto px-6 py-20"><p className="font-display text-2xl">Product not found.</p><Link href="/" className="btn-outline mt-6">BACK HOME</Link></div><Footer /></>;

  const eff = effectivePricePaise(product.sellingPrice, product.salePrice, product.saleStartsAt, product.saleEndsAt);
  const dp = discountPct(product.mrp, eff.price);
  const inStock = (activeVariant?.inventory ?? product.totalInventory) > 0;
  const stockLeft = activeVariant?.inventory ?? product.totalInventory;

  const handleAdd = () => {
    addItem({
      id: product.id,
      slug: product.slug,
      name: product.name,
      sellingPrice: eff.price,
      mrp: product.mrp,
      images: product.images,
      inventory: stockLeft,
      // Carry variant identification for cart
      variantId: activeVariant?.id,
      variantLabel: [activeVariant?.size, activeVariant?.color].filter(Boolean).join(' · ') || null,
    } as any, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = () => { handleAdd(); router.push('/cart'); };

  const TABS = [
    { id: 'craft', label: 'CRAFT STORY', body: product.story || product.description },
    { id: 'artisan', label: 'ARTISAN', body: product.artisanName
      ? `${product.artisanName} — ${product.region}${product.cluster ? ', ' + product.cluster : ''}. ${product.craftNote || ''}`
      : (product.craftNote || product.seller?.businessName || 'Crafted by NEEJEE-verified makers.')
    },
    { id: 'care', label: 'CARE', body: product.careInstructions || 'Dry-clean only. Store wrapped in muslin. Refold every 3 months. Keep away from direct sunlight.' },
    { id: 'delivery', label: 'DELIVERY', body: 'Free shipping above ₹2,500 across India. Standard 4-7 days. Express available at checkout. 7-day no-questions returns.' },
  ];

  // Colors and Sizes from variants
  const sizes = Array.from(new Set(product.variants.map((v: any) => v.size).filter(Boolean)));
  const colors = Array.from(new Set(product.variants.map((v: any) => v.color).filter(Boolean)));

  // Variant-aware gallery (v23.29):
  //   If the selected variant has its own images, show those.
  //   Otherwise fall back to the shared Product.images gallery.
  //   This keeps existing products (no per-variant images) working unchanged.
  const galleryImages: string[] =
    Array.isArray(activeVariant?.images) && activeVariant.images.length > 0
      ? activeVariant.images
      : (product.images || []);

  return (
    <>
      <Header />

      {/* Breadcrumb */}
      <nav className="max-w-8xl mx-auto px-6 lg:px-12 pt-6 font-ui text-xs tracking-widest text-mitti">
        <Link href="/" className="hover:text-madder">HOME</Link> ·
        {product.category && <> <Link href={`/categories/${product.category.slug}`} className="hover:text-madder"> {product.category.name.toUpperCase()}</Link> · </>}
        <span> {product.name.toUpperCase()}</span>
      </nav>

      <article className="max-w-8xl mx-auto px-6 lg:px-12 py-8 grid lg:grid-cols-2 gap-12">
        {/* GALLERY */}
        <section>
          <div className="aspect-[4/5] bg-beige relative overflow-hidden">
            {galleryImages?.[activeImage] ? (
              <Image src={galleryImages[activeImage]} alt={product.name} fill priority sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-mitti italic">No image</div>
            )}
            {eff.onSale && (
              <span className="absolute top-4 left-4 badge-founder">ON SALE · -{dp}%</span>
            )}
            {product.aiTryOnEligible && (
              <span className="absolute top-4 right-4 bg-kohl/80 text-ivory text-[10px] px-3 py-1 font-ui tracking-widest">✦ MIRROR ELIGIBLE</span>
            )}
            {product.arTryOnEligible && (
              <span className="absolute top-12 right-4 bg-madder/85 text-ivory text-[10px] px-3 py-1 font-ui tracking-widest">✦ AR TRY-ON</span>
            )}
          </div>
          {galleryImages?.length > 1 && (
            <div className="grid grid-cols-5 gap-2 mt-2">
              {galleryImages.slice(0, 5).map((img: string, i: number) => (
                <button key={i} onClick={() => setActiveImage(i)}
                  className={`aspect-square overflow-hidden bg-beige ${activeImage === i ? 'ring-2 ring-madder' : ''}`}>
                  <Image src={img} alt={`View ${i+1}`} width={150} height={150} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* INFO */}
        <section>
          {product.badges && product.badges.length > 0 && (
            <BadgeRow badges={product.badges} size="md" className="mb-4" />
          )}
          <h1 className="font-display text-4xl lg:text-5xl text-kohl mt-4">{product.name}</h1>
          {product.poeticLine && (
            <p className="font-italic italic text-mitti text-lg mt-2">{product.poeticLine}</p>
          )}

          {/* Prominent fulfilment status line — pre-order / edition-of-N */}
          {fulfilmentStatusLine(product) && (
            <p className="font-display text-lg text-madder mt-3 tracking-wide">
              {fulfilmentStatusLine(product)}
            </p>
          )}

          <div className="mt-6 flex items-baseline gap-3 flex-wrap">
            <span className={`font-display text-3xl ${eff.onSale ? 'text-madder' : 'text-kohl'}`}>{formatINR(eff.price)}</span>
            {eff.onSale && <span className="font-ui text-mitti line-through">{formatINR(product.sellingPrice)}</span>}
            {!eff.onSale && product.mrp > product.sellingPrice && (
              <span className="font-ui text-mitti line-through">{formatINR(product.mrp)}</span>
            )}
            {dp > 0 && <span className="font-ui text-sm text-madder">-{dp}% off</span>}
          </div>
          <p className="font-ui text-xs text-mitti mt-1">Inclusive of all taxes</p>

          {/* Color swatches */}
          {colors.length > 0 && (
            <div className="mt-8">
              <p className="label text-mitti mb-3">COLOR · {(activeVariant?.color || '').toUpperCase()}</p>
              <div className="flex gap-2 flex-wrap items-center">
                {colors.map((c: any) => {
                  const variant = product.variants.find((v: any) => v.color === c);
                  const hex = variant?.colorHex;
                  return (
                    <button key={c} onClick={() => { setActiveVariant(variant); setActiveImage(0); }}
                      className={`flex items-center gap-2 px-4 py-2 font-ui text-xs tracking-widest border transition-colors ${activeVariant?.color === c ? 'border-madder bg-madder text-ivory' : 'border-mitti/30 text-kohl hover:border-kohl'}`}>
                      {hex && (
                        <span className="inline-block w-3 h-3 rounded-full border border-mitti/30" style={{ backgroundColor: hex }} aria-hidden />
                      )}
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sizes */}
          {sizes.length > 0 && (
            <div className="mt-6">
              <p className="label text-mitti mb-3">SIZE · {(activeVariant?.size || 'FREE SIZE').toUpperCase()}</p>
              <div className="flex gap-2 flex-wrap">
                {sizes.map((s: any) => {
                  const variant = product.variants.find((v: any) => v.size === s && (!activeVariant?.color || v.color === activeVariant.color));
                  return (
                    <button key={s} onClick={() => { if (variant) { setActiveVariant(variant); setActiveImage(0); } }}
                      disabled={!variant || variant.inventory === 0}
                      className={`px-4 py-2 font-ui text-xs tracking-widest border transition-colors ${activeVariant?.id === variant?.id ? 'border-madder bg-madder text-ivory' : 'border-mitti/30 text-kohl hover:border-kohl'} disabled:opacity-30 disabled:line-through`}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity + CTAs */}
          <div className="mt-8 space-y-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center border border-mitti/20">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="p-3 hover:bg-beige" aria-label="Decrease">
                  <Minus className="w-3 h-3" />
                </button>
                <span className="px-6 font-ui text-sm w-12 text-center">{qty}</span>
                <button onClick={() => setQty(Math.min(stockLeft || 10, qty + 1))} className="p-3 hover:bg-beige" aria-label="Increase">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <p className="font-italic italic text-mitti text-sm">
                {fulfilmentStatusLine(product)
                  ? null  // already shown prominently below the title
                  : (inStock
                      ? (stockLeft <= 3 ? `Only ${stockLeft} left — found personally` : 'Ready to ship')
                      : 'Sold out')}
              </p>
            </div>

            {/* Pre-order deposit hint */}
            {isPreorder(product) && (
              <div className="mb-3 p-3 bg-beige/40 border border-mitti/20 text-xs text-mitti">
                Deposit today: <strong className="text-madder">{formatINR(checkoutPaise(product))}</strong>
                {' '}· Balance billed when piece is ready.
              </div>
            )}

            {/* Sold-out: waitlist instead of buy */}
            {isSoldOut(product) ? (
              <WaitlistSignup productId={product.id} productName={product.name} source="pdp" />
            ) : (
              <div className="flex gap-3">
                <button onClick={handleAdd} disabled={!inStock || added}
                  className="btn-primary flex-1 disabled:opacity-50 flex items-center justify-center gap-2">
                  {added ? (<><Check className="w-4 h-4" /> ADDED TO TRUNK</>) : buyCtaLabel(product).toUpperCase()}
                </button>
                <button onClick={handleBuyNow} disabled={!inStock} className="btn-outline flex-1 disabled:opacity-50">
                  {isPreorder(product) ? 'RESERVE NOW' : 'BUY NOW'}
                </button>
              </div>
            )}
            <button className="w-full mt-2 font-ui text-xs tracking-widest text-mitti hover:text-madder flex items-center justify-center gap-2">
              <Heart className="w-4 h-4" /> ADD TO WISHLIST
            </button>
          </div>

          {/* Trust strip */}
          <div className="mt-8 pt-6 border-t border-mitti/15 grid grid-cols-3 gap-4 text-center">
            <div>
              <Truck className="w-5 h-5 mx-auto text-madder" />
              <p className="font-ui text-[10px] tracking-widest text-kohl mt-2">FREE SHIPPING</p>
              <p className="font-italic italic text-mitti text-xs">Above ₹2,500</p>
            </div>
            <div>
              <RotateCcw className="w-5 h-5 mx-auto text-madder" />
              <p className="font-ui text-[10px] tracking-widest text-kohl mt-2">7-DAY RETURN</p>
              <p className="font-italic italic text-mitti text-xs">No questions</p>
            </div>
            <div>
              <ShieldCheck className="w-5 h-5 mx-auto text-madder" />
              <p className="font-ui text-[10px] tracking-widest text-kohl mt-2">VERIFIED CRAFT</p>
              <p className="font-italic italic text-mitti text-xs">Authentic</p>
            </div>
          </div>

          {/* Mirror entry */}
          {product.aiTryOnEligible && (
            <Link href={`/ai/mirror?product=${product.id}`}
              className="mt-6 block bg-kohl text-ivory p-5 hover:bg-mitti transition-colors">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-banarasi" />
                <div>
                  <p className="font-ui text-[10px] tracking-widest text-banarasi">NEEJEE MIRROR</p>
                  <p className="font-display text-lg">Try this on virtually</p>
                </div>
              </div>
            </Link>
          )}

          {/* AR Try-On entry (jewellery) */}
          {product.arTryOnEligible && (
            <Link href={`/ai/tryon?product=${product.id}`}
              className="mt-3 block bg-madder text-ivory p-5 hover:bg-kohl transition-colors">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-banarasi" />
                <div>
                  <p className="font-ui text-[10px] tracking-widest text-banarasi">AR TRY-ON</p>
                  <p className="font-display text-lg">See this piece on you</p>
                </div>
              </div>
            </Link>
          )}

          {/* Accordion */}
          <div className="mt-10 border-t border-mitti/15">
            {TABS.map(t => (
              <div key={t.id} className="border-b border-mitti/15">
                <button onClick={() => setOpenTab(openTab === t.id ? '' : t.id)}
                  className="w-full flex items-center justify-between py-4 text-left">
                  <span className="label text-kohl">{t.label}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${openTab === t.id ? 'rotate-180' : ''}`} />
                </button>
                {openTab === t.id && (
                  <div className="pb-5 font-body text-kohl/85 text-sm">
                    {t.body}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </article>

      <CompleteTheLook productId={product.id} limit={4} />

      <section className="max-w-8xl mx-auto px-6 lg:px-12 pb-20">
        <ReviewsSection productSlug={product.slug} />
      </section>

      <Footer />
    </>
  );
}

export default function PDPPage() {
  return (
    <Suspense fallback={<div className="p-12 text-mitti">Loading...</div>}>
      <PDPInner />
    </Suspense>
  );
}
