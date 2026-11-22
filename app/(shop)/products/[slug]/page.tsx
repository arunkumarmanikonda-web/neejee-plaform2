'use client';
import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Heart, Sparkles, Truck, RotateCcw, Plus, Minus, ChevronDown, Check, Home } from 'lucide-react';
import { formatINR, effectivePricePaise, discountPct } from '@/lib/money';
import { isPreorder, isSoldOut, fulfilmentStatusLine, buyCtaLabel, checkoutPaise } from '@/lib/fulfilment';
import { useCart } from '@/lib/cart-store';
import { WaitlistSignup } from '@/components/product/WaitlistSignup';
import { ReviewsSection } from '@/components/product/ReviewsSection';
import { BadgeRow } from '@/components/ui/Badge';
import { track } from '@/lib/analytics';
import { DetailViewer } from '@/components/product/DetailViewer';
import { pieceFields, readPieceFacts, type PieceFacts } from '@/lib/catalog/piece-notes';
import { ShareFind } from '@/components/product/ShareFind';
import { defaultStyling, lookUrl } from '@/lib/stylebook';
import { pickupLink } from '@/lib/counter';
import { studioHref } from '@/lib/studio';
import '@/components/shop/dressing.css';
import { CompleteTheLook } from '@/components/product/CompleteTheLook';

export const dynamic = 'force-dynamic';

function PDPInner() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const requestedVariant=useSearchParams().get('variant');
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
    const controller=new AbortController();
    setLoading(true); setError('');
    fetch(`/api/products/${slug}`,{signal:controller.signal})
      .then(r => r.json())
      .then(d => {
        if (controller.signal.aborted) return;
        if (d.error) { setError(d.error); return; }
        setProduct(d.product);
        const firstInStock = d.product.variants?.find((v: any) => v.inStock) || d.product.variants?.[0];
        setActiveVariant(d.product.variants?.find((v:any)=>v.id===requestedVariant) || firstInStock);
        setActiveImage(0);setQty(1);setAdded(false);
        track({ type: 'PRODUCT_VIEW', productId: d.product.id, value: d.product.sellingPrice });
      })
      .catch(e => {if(!controller.signal.aborted)setError(e.message);})
      .finally(() => {if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  }, [slug,requestedVariant]);

  useEffect(() => {
    if (!product?.id) return;
    let cancelled = false;
    fetch('/api/wishlist', { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (cancelled || !d?.loggedIn) return;
        const ids = Array.isArray(d.productIds) ? d.productIds : [];
        setInWishlist(ids.includes(product.id));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [product?.id]);

  if (loading) return <><Header shop/><div className="max-w-8xl mx-auto px-6 py-20 text-mitti">Loading...</div><Footer /></>;
  if (error || !product) return <><Header shop/><div className="max-w-8xl mx-auto px-6 py-20"><p className="font-display text-2xl">Product not found.</p><Link href="/" className="btn-outline mt-6">BACK HOME</Link></div><Footer /></>;

  const eff = effectivePricePaise(product.sellingPrice, product.salePrice, product.saleStartsAt, product.saleEndsAt);
  const dp = discountPct(product.mrp, eff.price);
  const inStock = activeVariant?.inStock ?? product.inStock ?? product.isInStock ?? false;
  const exactQuantityVisible = product.stock?.showExactQuantity === true;
  const stockLeft = exactQuantityVisible
    ? (activeVariant?.inventory ?? product.totalInventory ?? 0)
    : 50;

  const addAndGo = (destination: '/cart' | '/checkout') => {
    if (added || !inStock) return;
    addItem({
      id: product.id,
      slug: product.slug,
      name: product.name,
      sellingPrice: activeVariant?.sellingPrice ?? eff.price,
      mrp: product.mrp,
      images: galleryImages,
      inventory: stockLeft,
      variantId: activeVariant?.id,
      variantLabel: [activeVariant?.size, activeVariant?.color].filter(Boolean).join(' · ') || null,
    } as any, qty);
    setAdded(true);
    router.push(destination);
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

  const TABS = [
    { id: 'craft', label: 'CRAFT STORY', body: product.story || product.description },
    { id: 'artisan', label: 'ARTISAN', body: product.artisanName
      ? `${[product.artisanName,product.region].filter(Boolean).join(' · ')}${product.cluster ? ', ' + product.cluster : ''}. ${product.craftNote || ''}`
      : (product.craftNote || product.seller?.businessName || 'Ask our team about the maker of this piece.')
    },
    { id: 'care', label: 'CARE', body: product.careInstructions || 'Care guidance will be confirmed with your piece.' },
    { id: 'delivery', label: 'DELIVERY & RETURNS', body: [
      product.deliveryInfo || 'Delivery timing is confirmed at checkout.',
      product.returnPolicy || (product.returnEligible ? 'Eligible for return under the NEEJEE returns policy.' : 'Please review the product-specific return terms before purchase.'),
    ].filter(Boolean).join(' ') },
  ];

  const variants = Array.isArray(product.variants) ? product.variants : [];
  const sizes = Array.from(new Set(variants.map((v: any) => v.size).filter(Boolean)));
  const colors = Array.from(new Set(variants.map((v: any) => v.color).filter(Boolean)));

  const galleryImages: string[] =
    Array.isArray(activeVariant?.images) && activeVariant.images.length > 0
      ? activeVariant.images
      : (Array.isArray(product.images) ? product.images : []);

  return (
    <>
      <Header shop/>

      <nav className="max-w-8xl mx-auto px-6 lg:px-12 pt-6 font-ui text-xs tracking-widest text-mitti">
        <Link href="/" className="hover:text-madder">HOME</Link> ·
        {product.category && <> <Link href={`/categories/${product.category.path || product.category.slug}`} className="hover:text-madder"> {product.category.name.toUpperCase()}</Link> · </>}
        <span> {product.name.toUpperCase()}</span>
      </nav>

      <article className="nj-product-detail max-w-8xl mx-auto px-6 lg:px-12 py-8 grid lg:grid-cols-2 gap-12">
        <section>
          <div className="aspect-[4/5] bg-beige relative overflow-hidden">
            {galleryImages?.[activeImage] ? (
              <Image src={galleryImages[activeImage]} alt={product.name} fill priority sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-mitti italic">No image</div>
            )}
            <DetailViewer photos={galleryImages} selected={activeImage} onSelect={setActiveImage} name={product.name}/>
            {eff.onSale && (
              <span className="absolute top-4 left-4 badge-founder">ON SALE · -{dp}%</span>
            )}
            {product.arTryOnEligible && (
              <span className="absolute top-20 right-4 bg-madder/85 text-ivory text-[10px] px-3 py-1 font-ui tracking-widest">✦ AR TRY-ON</span>
            )}
          </div>
          {product.video && (/^https?:\/\//.test(product.video) || /^\/(?!\/)/.test(product.video)) && <details className="mt-3 border-y border-mitti/20 py-3">
            <summary className="cursor-pointer font-ui text-sm">{product.aiTryOnEligible?'Watch the drape':'Watch the piece in motion'}</summary>
            {/youtu\.be|youtube\.com|vimeo\.com/i.test(product.video)
              ? <a className="inline-block underline my-2" href={product.video}>Open the original film</a>
              : <video className="mt-3 max-h-96 w-full bg-ivory" controls playsInline preload="none" src={product.video} aria-label={'Film of '+product.name}/>}
          </details>}
          {galleryImages?.length > 1 && (
            <div className="grid grid-cols-5 gap-2 mt-2">
              {galleryImages.map((img: string, i: number) => (
                <button key={i} aria-pressed={activeImage===i} aria-label={`View photograph ${i+1}`} onClick={() => setActiveImage(i)}
                  className={`aspect-square overflow-hidden bg-beige ${activeImage === i ? 'ring-2 ring-madder' : ''}`}>
                  <Image src={img} alt={`View ${i + 1}`} width={150} height={150} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          {product.badges && product.badges.length > 0 && (
            <BadgeRow badges={product.badges} size="md" className="mb-4" />
          )}
          <h1 className="font-display text-4xl lg:text-5xl text-kohl mt-4">{product.name}</h1>
          {product.poeticLine && (
            <p className="font-italic italic text-mitti text-lg mt-2">{product.poeticLine}</p>
          )}

          {fulfilmentStatusLine(product) && (
            <p className="font-display text-lg text-madder mt-3 tracking-wide">
              {fulfilmentStatusLine(product)}
            </p>
          )}

          <div className="mt-6 flex items-baseline gap-3 flex-wrap">
            <span className={`font-display text-3xl ${eff.onSale ? 'text-madder' : 'text-kohl'}`}>{formatINR(activeVariant?.sellingPrice ?? eff.price)}</span>
            {eff.onSale && <span className="font-ui text-mitti line-through">{formatINR(product.sellingPrice)}</span>}
            {!eff.onSale && product.mrp > product.sellingPrice && (
              <span className="font-ui text-mitti line-through">{formatINR(product.mrp)}</span>
            )}
            {dp > 0 && <span className="font-ui text-sm text-madder">-{dp}% off</span>}
          </div>
          <p className="font-ui text-xs text-mitti mt-1">Inclusive of all taxes</p>

          <dl className="nj-product-facts">{[
            ['Colour',activeVariant?.color],['Craft',product.craft],['Technique',product.technique],['Fabric',activeVariant?.material || product.material],['Origin',[product.cluster,product.region,product.state].filter((v,i,a)=>v && a.indexOf(v)===i).join(', ')],
          ].filter(([,v])=>v).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          {product.description && <p className="nj-product-description">{product.description}</p>}
          {colors.length > 0 && (
            <div className="mt-8">
              <p className="label text-mitti mb-3">COLOR · {(activeVariant?.color || '').toUpperCase()}</p>
              <div className="flex gap-2 flex-wrap items-center">
                {colors.map((c: any) => {
                  const variant = variants.find((v: any) => v.color === c);
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

          {sizes.length > 0 && (
            <div className="mt-6">
              <p className="label text-mitti mb-3">SIZE · {(activeVariant?.size || 'FREE SIZE').toUpperCase()}</p>
              <div className="flex gap-2 flex-wrap">
                {sizes.map((s: any) => {
                  const variant = variants.find((v: any) => v.size === s && (!activeVariant?.color || v.color === activeVariant.color));
                  return (
                    <button key={s} onClick={() => { if (variant) { setActiveVariant(variant); setActiveImage(0); } }}
                      disabled={!variant || !variant.inStock}
                      className={`px-4 py-2 font-ui text-xs tracking-widest border transition-colors ${activeVariant?.id === variant?.id ? 'border-madder bg-madder text-ivory' : 'border-mitti/30 text-kohl hover:border-kohl'} disabled:opacity-30 disabled:line-through`}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
                  ? null
                  : (inStock
                      ? (exactQuantityVisible && stockLeft <= 3 ? `Only ${stockLeft} left · found personally` : 'Ready to ship')
                      : 'Sold out')}
              </p>
            </div>

            {isPreorder(product) && (
              <div className="mb-3 p-3 bg-beige/40 border border-mitti/20 text-xs text-mitti">
                Deposit today: <strong className="text-madder">{formatINR(checkoutPaise(product))}</strong>
                {' '}· Balance billed when piece is ready.
              </div>
            )}

            {isSoldOut(product) ? (
              <WaitlistSignup productId={product.id} productName={product.name} source="pdp" />
            ) : (
              <div className="flex gap-3">
                <button onClick={()=>addAndGo('/checkout')} disabled={!inStock || added} className="btn-primary flex-1 disabled:opacity-50">
                  {isPreorder(product) ? 'RESERVE NOW' : 'BUY NOW'}
                </button>
                <button onClick={()=>addAndGo('/cart')} disabled={!inStock || added} className="btn-outline flex-1 disabled:opacity-50">
                  {added ? 'ADDED TO BAG' : buyCtaLabel(product).toUpperCase()}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleWishlist}
              disabled={wishlistBusy}
              aria-pressed={inWishlist}
              className={`w-full mt-2 font-ui text-xs tracking-widest flex items-center justify-center gap-2 transition-colors ${inWishlist ? 'text-madder' : 'text-mitti hover:text-madder'} disabled:opacity-50`}
            >
              <Heart className={`w-4 h-4 ${inWishlist ? 'fill-current' : ''}`} />
              {wishlistBusy ? 'SAVING…' : inWishlist ? 'SAVED TO WISHLIST' : 'ADD TO WISHLIST'}
            </button>
            {wishlistMessage && <p className="text-center font-italic italic text-xs text-mitti">{wishlistMessage}</p>}
          </div>

          {(product.aiTryOnEligible || product.aiRoomEligible) && inStock && <div className="my-5 flex flex-wrap gap-3">
            {product.aiRoomEligible && <Link className="border border-mitti px-4 py-3 font-ui text-sm" href={studioHref('imagine',product.slug,activeVariant?.id)}>See it in my room</Link>}
            {product.aiTryOnEligible && <Link className="border border-mitti px-4 py-3 font-ui text-sm" href={studioHref('mirror',product.slug,activeVariant?.id)}>Try on with Aaina</Link>}
            {product.aiTryOnEligible && activeVariant?.inStock && <Link className="border border-mitti px-4 py-3 font-ui text-sm" href={lookUrl('/looks',defaultStyling(),product.slug,activeVariant.id)}>Style with juttis &amp; jewellery</Link>}
          </div>}
          {activeVariant?.inStock && (/^(women\/(sarees|apparel|suits)|men\/apparel)(\/|$)/.test(product.category?.path||'')) && <Link className="my-3 inline-block text-madder underline underline-offset-4" href={pickupLink(activeVariant.id)}>Compare this saree</Link>}

          {Object.keys(readPieceFacts(product.pieceFacts)).length>0 && <section className="mt-5 border-t border-mitti/30 pt-4"><h2 className="font-display text-xl">Before you choose</h2><dl className="mt-2 grid gap-2 text-sm">{Object.entries(readPieceFacts(product.pieceFacts)).map(([key,value])=><div key={key}><dt className="font-semibold">{pieceFields[key as keyof PieceFacts]}</dt><dd>{value}</dd></div>)}</dl></section>}
          <section aria-label="Details about this piece" className="mt-8 border-y border-mitti/25 py-5">
            <h2 className="font-display text-2xl">The piece, up close</h2>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-sm">
              {Object.entries({Origin:product.region,Material:product.material,Technique:product.technique,Maker:product.artisanName}).filter(([,v])=>v).map(([key,value])=><div className="contents" key={key}><dt className="font-medium">{key}</dt><dd>{String(value)}</dd></div>)}
              <dt>Delivery</dt><dd><Link className="underline" href="/help/shipping">Shipping and delivery</Link></dd>
              <dt>Returns</dt><dd>{product.returnPolicy || (product.returnEligible?'Eligible under the returns policy.':'This piece is marked ineligible for return.')} <Link className="underline" href="/help/returns">Read policy</Link></dd>
            </dl>
            <button className="mt-4 text-madder underline underline-offset-4" onClick={()=>window.dispatchEvent(new CustomEvent('neejee:ask-pitari',{detail:'Where is it from?'}))}>Ask Sakhi about this piece</button>
            <ShareFind href={'/products/'+product.slug} name={product.name}/>
          </section>

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
