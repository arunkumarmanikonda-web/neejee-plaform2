'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Heart, Sparkles, Truck, RotateCcw, ShieldCheck, Plus, Minus, ChevronDown, Check, Home } from 'lucide-react';
import { formatINR, effectivePricePaise, discountPct } from '@/lib/money';
import { isPreorder, isSoldOut, fulfilmentStatusLine, buyCtaLabel, checkoutPaise } from '@/lib/fulfilment';
import { useCart } from '@/lib/cart-store';
import { WaitlistSignup } from '@/components/product/WaitlistSignup';
import { ReviewsSection } from '@/components/product/ReviewsSection';
import { BadgeChipRow } from '@/components/ui/Badge';
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
  const [inWishlist, setInWishlist] = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [wishlistMessage, setWishlistMessage] = useState('');

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError('');
    fetch(`/api/products/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setProduct(data.product);
        const firstInStock = data.product.variants?.find((v: any) => v.inStock) || data.product.variants?.[0];
        setActiveVariant(firstInStock);
        track({ type: 'PRODUCT_VIEW', productId: data.product.id, value: data.product.sellingPrice });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!product?.id) return;
    let cancelled = false;
    fetch('/api/wishlist', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled || !data?.loggedIn) return;
        const ids = Array.isArray(data.productIds) ? data.productIds : [];
        setInWishlist(ids.includes(product.id));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [product?.id]);

  if (loading) {
    return <><Header /><div className="max-w-[1440px] mx-auto px-6 py-28 font-display italic text-mitti">Finding your piece…</div><Footer /></>;
  }

  if (error || !product) {
    return <><Header /><div className="max-w-3xl mx-auto px-6 py-28 text-center"><p className="editorial-kicker">THE EDIT</p><h1 className="font-display text-4xl mt-3">This piece is no longer here.</h1><Link href="/" className="btn-outline mt-8">RETURN HOME</Link></div><Footer /></>;
  }

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
      variantId: activeVariant?.id,
      variantLabel: [activeVariant?.size, activeVariant?.color].filter(Boolean).join(' · ') || null,
    } as any, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = () => {
    handleAdd();
    router.push('/cart');
  };

  const handleWishlist = async () => {
    if (wishlistBusy) return;
    setWishlistBusy(true);
    setWishlistMessage('');
    try {
      const response = await fetch('/api/wishlist', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id }),
      });
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/products/${product.slug}`)}`);
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to update wishlist');
      setInWishlist(!!data.inWishlist);
      setWishlistMessage(data.inWishlist ? 'Saved personally.' : 'Removed from your saved pieces.');
      setTimeout(() => setWishlistMessage(''), 2200);
    } catch {
      setWishlistMessage('Could not update your wishlist. Please try again.');
    } finally {
      setWishlistBusy(false);
    }
  };

  const tabs = [
    { id: 'craft', label: 'CRAFT STORY', body: product.story || product.description },
    {
      id: 'artisan',
      label: 'ARTISAN PROFILE',
      body: product.artisanName
        ? `${product.artisanName} · ${product.region}${product.cluster ? ', ' + product.cluster : ''}. ${product.craftNote || ''}`
        : (product.craftNote || product.seller?.businessName || 'Crafted by NEEJEE-verified makers.'),
    },
    { id: 'care', label: 'CARE', body: product.careInstructions || 'Care guidance will be confirmed with your piece.' },
    {
      id: 'delivery',
      label: 'DELIVERY & RETURNS',
      body: [
        product.deliveryInfo || 'Delivery timing is confirmed at checkout.',
        product.returnPolicy || (product.returnEligible ? 'Eligible for return under the NEEJEE returns policy.' : 'Please review the product-specific return terms before purchase.'),
      ].filter(Boolean).join(' '),
    },
  ];

  const variants = Array.isArray(product.variants) ? product.variants : [];
  const sizes = Array.from(new Set(variants.map((v: any) => v.size).filter(Boolean)));
  const colors = Array.from(new Set(variants.map((v: any) => v.color).filter(Boolean)));
  const galleryImages: string[] = Array.isArray(activeVariant?.images) && activeVariant.images.length > 0
    ? activeVariant.images
    : Array.isArray(product.images) ? product.images : [];

  return (
    <>
      <Header />

      <nav className="max-w-[1600px] mx-auto px-5 sm:px-8 lg:px-12 pt-6 font-ui text-[9px] tracking-[0.16em] text-mitti">
        <Link href="/" className="hover:text-madder">HOME</Link>
        {product.category && <> <span className="mx-2">/</span><Link href={`/categories/${product.category.path || product.category.slug}`} className="hover:text-madder">{product.category.name.toUpperCase()}</Link></>}
        <span className="hidden sm:inline"><span className="mx-2">/</span>{product.name.toUpperCase()}</span>
      </nav>

      <article className="max-w-[1600px] mx-auto px-5 sm:px-8 lg:px-12 pt-6 pb-14 lg:pb-20 grid lg:grid-cols-[1.08fr_.92fr] gap-8 lg:gap-12 xl:gap-16 items-start">
        <section className="min-w-0">
          <div className="aspect-square sm:aspect-[5/4] xl:aspect-[4/3] bg-beige relative overflow-hidden border border-mitti/12">
            {galleryImages?.[activeImage] ? (
              <Image src={galleryImages[activeImage]} alt={product.name} fill priority sizes="(min-width:1024px) 58vw, 100vw" className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-mitti font-display italic">Image being prepared</div>
            )}
            {eff.onSale && <span className="absolute top-4 left-4 badge-founder">ON SALE · {dp}% OFF</span>}
            {product.aiTryOnEligible && <span className="absolute bottom-4 left-4 border border-ivory/70 bg-kohl/70 backdrop-blur-sm text-ivory text-[9px] px-3 py-1.5 font-ui tracking-[0.18em]">MIRROR ✦</span>}
          </div>

          {galleryImages?.length > 1 && (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mt-2.5">
              {galleryImages.slice(0, 5).map((img: string, index: number) => (
                <button key={img + index} onClick={() => setActiveImage(index)} aria-label={`View product image ${index + 1}`} className={`aspect-[4/3] overflow-hidden bg-beige border transition-colors ${activeImage === index ? 'border-madder' : 'border-mitti/15 hover:border-mitti/50'}`}>
                  <Image src={img} alt={`${product.name}, view ${index + 1}`} width={220} height={165} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="lg:sticky lg:top-[122px] lg:self-start max-w-xl">
          {product.badges?.length > 0 && <BadgeChipRow badges={product.badges} />}
          <p className="editorial-kicker mt-5">{[product.craft, product.region].filter(Boolean).join(' · ') || 'NEEJEE SELECT'}</p>
          <h1 className="font-display text-[38px] sm:text-[46px] lg:text-[52px] leading-[1.02] text-kohl mt-3">{product.name}</h1>
          {product.poeticLine && <p className="font-display italic text-mitti text-[17px] mt-3">{product.poeticLine}</p>}
          <div className="madder-divider mt-6" />

          {fulfilmentStatusLine(product) && <p className="font-ui text-[10px] tracking-[0.16em] text-madder mt-5">{fulfilmentStatusLine(product).toUpperCase()}</p>}

          <div className="mt-6 flex items-baseline gap-3 flex-wrap">
            <span className={`font-display text-[28px] ${eff.onSale ? 'text-madder' : 'text-kohl'}`}>{formatINR(eff.price)}</span>
            {eff.onSale && <span className="font-ui text-xs text-mitti line-through">{formatINR(product.sellingPrice)}</span>}
            {!eff.onSale && product.mrp > product.sellingPrice && <span className="font-ui text-xs text-mitti line-through">{formatINR(product.mrp)}</span>}
            {dp > 0 && <span className="font-ui text-[10px] tracking-wider text-madder">{dp}% OFF</span>}
          </div>
          <p className="font-ui text-[9px] tracking-wide text-mitti mt-1.5">INCLUSIVE OF ALL TAXES</p>

          {colors.length > 0 && (
            <div className="mt-8 pt-6 border-t border-mitti/15">
              <p className="font-ui text-[9px] tracking-[0.18em] text-kohl mb-3">COLOUR · {(activeVariant?.color || '').toUpperCase()}</p>
              <div className="flex gap-3 flex-wrap items-center">
                {colors.map((color: any) => {
                  const variant = variants.find((v: any) => v.color === color);
                  const hex = variant?.colorHex;
                  const selected = activeVariant?.color === color;
                  return (
                    <button key={color} onClick={() => { setActiveVariant(variant); setActiveImage(0); }} className={`group/color flex items-center gap-2 p-1 border ${selected ? 'border-madder' : 'border-transparent hover:border-mitti/30'}`} aria-label={`Colour ${color}`} aria-pressed={selected}>
                      <span className="w-7 h-7 rounded-full border border-mitti/25" style={{ backgroundColor: hex || '#E8DFCF' }} aria-hidden="true" />
                      <span className="font-ui text-[9px] tracking-wider text-mitti hidden sm:inline">{String(color).toUpperCase()}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {sizes.length > 0 && (
            <div className="mt-6">
              <p className="font-ui text-[9px] tracking-[0.18em] text-kohl mb-3">SIZE · {(activeVariant?.size || 'FREE SIZE').toUpperCase()}</p>
              <div className="flex gap-2 flex-wrap">
                {sizes.map((size: any) => {
                  const variant = variants.find((v: any) => v.size === size && (!activeVariant?.color || v.color === activeVariant.color));
                  return (
                    <button key={size} onClick={() => { if (variant) { setActiveVariant(variant); setActiveImage(0); } }} disabled={!variant || variant.inventory === 0} className={`min-w-12 px-4 py-2.5 font-ui text-[10px] tracking-widest border transition-colors ${activeVariant?.id === variant?.id ? 'border-madder bg-madder text-ivory' : 'border-mitti/30 text-kohl hover:border-kohl'} disabled:opacity-30 disabled:line-through`}>
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-8 space-y-3">
            <div className="flex items-center justify-between gap-4 pb-3">
              <div className="flex items-center border border-mitti/25">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="p-3 hover:bg-beige" aria-label="Decrease quantity"><Minus className="w-3.5 h-3.5" strokeWidth={1.3} /></button>
                <span className="px-4 font-ui text-xs min-w-12 text-center">{qty}</span>
                <button onClick={() => setQty(Math.min(stockLeft || 10, qty + 1))} className="p-3 hover:bg-beige" aria-label="Increase quantity"><Plus className="w-3.5 h-3.5" strokeWidth={1.3} /></button>
              </div>
              <p className="font-display italic text-mitti text-[13px] text-right">
                {fulfilmentStatusLine(product) ? null : inStock ? (stockLeft <= 3 ? `Only ${stockLeft} left` : 'Ready to ship') : 'Sold out'}
              </p>
            </div>

            {isPreorder(product) && (
              <div className="p-3 bg-paper-deep/55 border border-mitti/15 font-ui text-[10px] tracking-wide text-mitti">
                DEPOSIT TODAY · <strong className="text-madder">{formatINR(checkoutPaise(product))}</strong> · BALANCE WHEN READY
              </div>
            )}

            {isSoldOut(product) ? (
              <WaitlistSignup productId={product.id} productName={product.name} source="pdp" />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={handleAdd} disabled={!inStock || added} className="btn-primary disabled:opacity-50 flex items-center justify-center gap-2">
                  {added ? <><Check className="w-4 h-4" /> ADDED</> : buyCtaLabel(product).toUpperCase()}
                </button>
                <button onClick={handleBuyNow} disabled={!inStock} className="btn-outline disabled:opacity-50">{isPreorder(product) ? 'RESERVE NOW' : 'BUY NOW'}</button>
              </div>
            )}

            <button type="button" onClick={handleWishlist} disabled={wishlistBusy} aria-pressed={inWishlist} className={`w-full py-2 font-ui text-[9px] tracking-[0.18em] flex items-center justify-center gap-2 transition-colors ${inWishlist ? 'text-madder' : 'text-mitti hover:text-madder'} disabled:opacity-50`}>
              <Heart className={`w-4 h-4 ${inWishlist ? 'fill-current' : ''}`} strokeWidth={1.35} />
              {wishlistBusy ? 'SAVING…' : inWishlist ? 'SAVED TO WISHLIST' : 'SAVE THIS PIECE'}
            </button>
            {wishlistMessage && <p className="text-center font-display italic text-xs text-mitti">{wishlistMessage}</p>}
          </div>

          <div className="mt-7 border-y border-mitti/15 grid grid-cols-3 divide-x divide-mitti/15 text-center">
            <div className="px-2 py-4"><Truck className="w-4 h-4 mx-auto text-madder" strokeWidth={1.3} /><p className="font-ui text-[8px] tracking-[0.16em] text-kohl mt-2">DELIVERY</p><p className="font-display italic text-mitti text-[11px] mt-1">At checkout</p></div>
            <div className="px-2 py-4"><RotateCcw className="w-4 h-4 mx-auto text-madder" strokeWidth={1.3} /><p className="font-ui text-[8px] tracking-[0.16em] text-kohl mt-2">RETURNS</p><p className="font-display italic text-mitti text-[11px] mt-1">{product.returnEligible ? 'Eligible' : 'Product-specific'}</p></div>
            <div className="px-2 py-4"><ShieldCheck className="w-4 h-4 mx-auto text-madder" strokeWidth={1.3} /><p className="font-ui text-[8px] tracking-[0.16em] text-kohl mt-2">AUTHENTICITY</p><p className="font-display italic text-mitti text-[11px] mt-1">NEEJEE verified</p></div>
          </div>

          {(product.aiTryOnEligible || product.aiRoomEligible || product.arTryOnEligible) && (
            <div className="mt-7 border border-madder/28 bg-paper-deep/35 p-5">
              <p className="editorial-kicker flex items-center gap-2"><Sparkles className="w-4 h-4" strokeWidth={1.2} /> SEE IT PERSONALLY</p>
              <div className="mt-3 space-y-2">
                {product.aiTryOnEligible && <Link href={`/ai/mirror?product=${product.id}`} className="flex items-center justify-between font-display text-lg text-kohl hover:text-madder">The NEEJEE Mirror <span className="font-ui text-[9px] tracking-wider">OPEN →</span></Link>}
                {product.aiRoomEligible && <Link href={`/ai/space?product=${product.id}`} className="flex items-center justify-between font-display text-lg text-kohl hover:text-madder">The NEEJEE Space <Home className="w-4 h-4 text-madder" strokeWidth={1.2} /></Link>}
                {product.arTryOnEligible && <Link href={`/ai/tryon?product=${product.id}`} className="flex items-center justify-between font-display text-lg text-kohl hover:text-madder">AR Try-on <span className="font-ui text-[9px] tracking-wider">OPEN →</span></Link>}
              </div>
            </div>
          )}

          <div className="mt-8 border-t border-mitti/15">
            {tabs.map((tab) => (
              <div key={tab.id} className="border-b border-mitti/15">
                <button onClick={() => setOpenTab(openTab === tab.id ? '' : tab.id)} className="w-full flex items-center justify-between py-4 text-left" aria-expanded={openTab === tab.id}>
                  <span className="font-ui text-[9px] tracking-[0.18em] text-kohl">{tab.label}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${openTab === tab.id ? 'rotate-180' : ''}`} strokeWidth={1.2} />
                </button>
                {openTab === tab.id && <div className="pb-5 font-display text-kohl/80 text-[14px] leading-relaxed">{tab.body}</div>}
              </div>
            ))}
          </div>
        </section>
      </article>

      <CompleteTheLook productId={product.id} limit={4} />
      <section className="max-w-[1440px] mx-auto px-5 sm:px-8 lg:px-12 pb-20"><ReviewsSection productSlug={product.slug} /></section>
      <Footer />
    </>
  );
}

export default function PDPPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ivory p-12 font-display italic text-mitti">Finding your piece…</div>}>
      <PDPInner />
    </Suspense>
  );
}
