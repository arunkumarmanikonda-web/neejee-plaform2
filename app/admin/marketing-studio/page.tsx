'use client';
import { useEffect, useState } from 'react';
import {
  Sparkles, Loader2, Package, Layers, Tag, MessageCircle,
  Copy, Save, Download, RefreshCw, Check,
} from 'lucide-react';
import { formatINR } from '@/lib/money';

type Flow = 'single_product' | 'range' | 'offer' | 'generic';
type Format = 'ig_square' | 'ig_story' | 'email_banner' | 'fb_banner';
type Style = 'minimal' | 'editorial' | 'festive' | 'moody';

const FLOWS: { v: Flow; l: string; icon: any; desc: string }[] = [
  { v: 'single_product', l: 'Single product',  icon: Package,       desc: 'Spotlight one piece' },
  { v: 'range',          l: 'Collection',      icon: Layers,        desc: 'Multiple products / a category' },
  { v: 'offer',          l: 'Offer / coupon',  icon: Tag,           desc: 'Discount, festival, sale moment' },
  { v: 'generic',        l: 'Brand moment',    icon: MessageCircle, desc: 'Free-text brief, no product' },
];

const FORMATS: { v: Format; l: string; ar: string; cls: string }[] = [
  { v: 'ig_square',    l: 'IG Square',    ar: '1:1',  cls: 'aspect-square' },
  { v: 'ig_story',     l: 'IG Story',     ar: '9:16', cls: 'aspect-[9/16]' },
  { v: 'email_banner', l: 'Email banner', ar: '2:1',  cls: 'aspect-[2/1]' },
  { v: 'fb_banner',    l: 'FB / Web',     ar: '16:9', cls: 'aspect-video' },
];

const STYLES: { v: Style; l: string; desc: string }[] = [
  { v: 'minimal',   l: 'Minimal',   desc: 'Lots of space, soft light' },
  { v: 'editorial', l: 'Editorial', desc: 'Magazine framing' },
  { v: 'festive',   l: 'Festive',   desc: 'Warm, traditional motifs' },
  { v: 'moody',     l: 'Moody',     desc: 'Cinematic, low-key' },
];

export default function MarketingStudioPage() {
  const [flow, setFlow] = useState<Flow>('single_product');
  // v23.34.1 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â multi-select format & style. Default to a sensible 3-format bundle.
  const [formats, setFormats] = useState<Format[]>(['ig_square', 'ig_story', 'fb_banner']);
  const [styles, setStyles] = useState<Style[]>(['editorial']);
  // v23.34.1 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â branded overlay controls
  const [brandLogo, setBrandLogo] = useState(true);
  const [ctaText, setCtaText] = useState('SHOP NOW');
  const [badgesCsv, setBadgesCsv] = useState('FOUNDERÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢S EDIT ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· HANDLOOM CERTIFIED');

  // Per-flow inputs
  const [productId, setProductId] = useState('');
  const [productIds, setProductIds] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [couponId, setCouponId] = useState('');
  const [discountText, setDiscountText] = useState('');
  const [brief, setBrief] = useState('');
  const [tone, setTone] = useState('');

  // Picker data
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [pickerError, setPickerError] = useState('');

  // Output
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState('');
  const [savedAssets, setSavedAssets] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const loadPickers = async () => {
      const issues: string[] = [];

      const [productsRes, categoriesRes, couponsRes] = await Promise.allSettled([
        fetch('/api/admin/products?limit=200', { credentials: 'include', cache: 'no-store' }).then(async r => {
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j.error || 'products unavailable');
          return j;
        }),
        fetch('/api/admin/categories', { credentials: 'include', cache: 'no-store' }).then(async r => {
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j.error || 'categories unavailable');
          return j;
        }),
        fetch('/api/admin/coupons', { credentials: 'include', cache: 'no-store' }).then(async r => {
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j.error || 'coupons unavailable');
          return j;
        }),
      ]);

      if (cancelled) return;

      if (productsRes.status === 'fulfilled') {
        setProducts(productsRes.value.products || productsRes.value || []);
      } else {
        setProducts([]);
        issues.push('products');
      }

      if (categoriesRes.status === 'fulfilled') {
        setCategories(categoriesRes.value.categories || []);
      } else {
        setCategories([]);
        issues.push('categories');
      }

      if (couponsRes.status === 'fulfilled') {
        setCoupons(couponsRes.value.coupons || couponsRes.value || []);
      } else {
        setCoupons([]);
        issues.push('coupons');
      }

      setPickerError(
        issues.length
          ? `Some Studio inputs could not be loaded: ${issues.join(', ')}. Check role access or API errors.`
          : ''
      );
    };

    loadPickers().catch(() => {
      if (!cancelled) {
        setPickerError('Studio inputs could not be loaded. Please retry.');
      }
    });

    return () => { cancelled = true; };
  }, []);

  const ready = (() => {
    if (formats.length === 0 || styles.length === 0) return false;
    if (flow === 'single_product') return !!productId;
    if (flow === 'range') return productIds.length > 0 || !!categoryId;
    if (flow === 'offer') return !!couponId || !!discountText;
    if (flow === 'generic') return brief.trim().length > 5;
    return false;
  })();

  const generate = async () => {
    setErr(''); setResult(null); setSavedAssets(new Set()); setGenerating(true);
    try {
      const r = await fetch('/api/admin/marketing-studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flow,
          formats, styles,
          productId: flow === 'single_product' ? productId : undefined,
          productIds: flow === 'range' && productIds.length ? productIds : undefined,
          categoryId: flow === 'range' && !productIds.length ? categoryId : undefined,
          couponId: flow === 'offer' && couponId ? couponId : undefined,
          discountText: flow === 'offer' ? discountText : undefined,
          brief: brief || undefined,
          tone: tone || undefined,
          variants: 1,                         // 1 per (format, style) pair
          brandLogo,
          ctaText: ctaText.trim() || undefined,
          productBadges: badgesCsv.split(/[,ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â·]/).map(s => s.trim()).filter(Boolean),
        }),
      });
      const t = await r.text();
      let j: any = {}; try { j = JSON.parse(t); } catch {}
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setResult(j);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const saveToAssets = async (variantIdx: number) => {
    if (!result?.variants[variantIdx]) return;
    const variant = result.variants[variantIdx];
    const url = variant.url;
    const productCtx = result.diagnostics.productNames?.[0] || 'NEEJEE brand';
    const alt = `Marketing Studio ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ${productCtx} (${variant.style || ''})`;
    try {
      const r = await fetch('/api/admin/marketing-studio/save-asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url, alt,
          caption: result.copy.instagramCaption,
          tags: ['marketing-studio', result.diagnostics.flow, variant.style, variant.format].filter(Boolean),
        }),
      });
      if (r.ok) {
        const newSet = new Set(savedAssets);
        newSet.add(variantIdx);
        setSavedAssets(newSet);
      }
    } catch { /* */ }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="font-display text-3xl text-kohl flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-banarasi" /> Marketing Studio
        </h1>
        <p className="text-mitti text-sm">
          AI-generated creatives & copy for Instagram, email, WhatsApp ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â pick what to feature, get 4 variants in seconds.
        </p>
      </div>

      {/* Step 1: Flow */}
      <Section step="1" title="What are you posting about?">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {FLOWS.map(f => (
            <button key={f.v} onClick={() => setFlow(f.v)}
              className={`text-left p-4 rounded border transition-colors ${
                flow === f.v ? 'border-kohl bg-beige/40' : 'border-mitti/20 hover:border-kohl/50'
              }`}>
              <f.icon className="w-5 h-5 text-banarasi" />
              <p className="font-display text-base text-kohl mt-2">{f.l}</p>
              <p className="text-xs text-mitti mt-1">{f.desc}</p>
            </button>
          ))}
        </div>
      </Section>

      {/* Step 2: Inputs per flow */}
      <Section step="2" title="Pick the subject">
        {flow === 'single_product' && (
          <ProductPicker products={products} selectedId={productId} onSelect={setProductId} />
        )}
        {flow === 'range' && (
          <RangePicker products={products} categories={categories}
            productIds={productIds} onProductsChange={setProductIds}
            categoryId={categoryId} onCategoryChange={setCategoryId} />
        )}
        {flow === 'offer' && (
          <OfferPicker coupons={coupons} couponId={couponId} onCouponChange={setCouponId}
            discountText={discountText} onDiscountTextChange={setDiscountText} />
        )}
        {flow === 'generic' && (
          <textarea value={brief} onChange={e => setBrief(e.target.value)}
            rows={3}
            placeholder="e.g. We're celebrating 100 sarees sold from our Banarasi atelier ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â gratitude-forward, warm light, the loom in the background."
            className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
        )}
      </Section>

      {/* Step 3: Format & style ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â MULTI-SELECT */}
      <Section step="3" title="Format & style">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="label text-banarasi mb-2">FORMATS ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· PICK ONE OR MANY</p>
            <div className="grid grid-cols-2 gap-2">
              {FORMATS.map(f => {
                const selected = formats.includes(f.v);
                return (
                  <button key={f.v}
                    onClick={() => setFormats(p => selected ? p.filter(x => x !== f.v) : [...p, f.v])}
                    className={`text-left px-3 py-2 rounded border transition-colors ${
                      selected ? 'border-kohl bg-beige/60' : 'border-mitti/20 hover:border-kohl/50'
                    }`}>
                    <p className="font-display text-sm text-kohl flex items-center gap-1">
                      {selected && <span className="text-madder">ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ</span>} {f.l}
                    </p>
                    <p className="text-xs text-mitti">{f.ar}</p>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-mitti mt-1">Each selected format produces its own creative.</p>
          </div>
          <div>
            <p className="label text-banarasi mb-2">STYLES ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· PICK ONE OR MANY</p>
            <div className="grid grid-cols-2 gap-2">
              {STYLES.map(s => {
                const selected = styles.includes(s.v);
                return (
                  <button key={s.v}
                    onClick={() => setStyles(p => selected ? p.filter(x => x !== s.v) : [...p, s.v])}
                    className={`text-left px-3 py-2 rounded border transition-colors ${
                      selected ? 'border-kohl bg-beige/60' : 'border-mitti/20 hover:border-kohl/50'
                    }`}>
                    <p className="font-display text-sm text-kohl flex items-center gap-1">
                      {selected && <span className="text-madder">ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ</span>} {s.l}
                    </p>
                    <p className="text-xs text-mitti">{s.desc}</p>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-mitti mt-1">Each selected style is combined with every selected format.</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-mitti/10 pt-4">
          <div className="md:col-span-3">
            <p className="label text-banarasi mb-1">BRANDING OVERLAY</p>
            <p className="text-[11px] text-mitti italic">Every creative is rendered with the NEEJEE wordmark, the badges you select, and a CTA button burned into the image ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ready to post.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={brandLogo} onChange={e => setBrandLogo(e.target.checked)} />
            NEEJEE wordmark
          </label>
          <div>
            <p className="label text-banarasi mb-1">CTA</p>
            <input value={ctaText} onChange={e => setCtaText(e.target.value)} placeholder="SHOP NOW"
              className="w-full border border-mitti/30 px-2 py-1 font-ui text-xs bg-ivory tracking-widest uppercase" />
          </div>
          <div>
            <p className="label text-banarasi mb-1">BADGES (comma-sep)</p>
            <input value={badgesCsv} onChange={e => setBadgesCsv(e.target.value)}
              placeholder="FOUNDERÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢S EDIT, HANDLOOM CERTIFIED"
              className="w-full border border-mitti/30 px-2 py-1 font-ui text-xs bg-ivory" />
          </div>
        </div>

        <div className="mt-4">
          <p className="label text-banarasi mb-1">TONE OVERRIDE <span className="text-mitti font-normal">ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â optional</span></p>
          <input value={tone} onChange={e => setTone(e.target.value)}
            placeholder="e.g. warm, urgent, calm, gratitude-forward"
            className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
        </div>
      </Section>

      {pickerError && (
        <div className="bg-haldi/10 border border-haldi/40 p-3 text-haldi text-sm">
          {pickerError}
        </div>
      )}

      {err && <div className="bg-madder/10 border border-madder p-3 text-madder text-sm">{err}</div>}

      {/* Generate button */}
      <div className="sticky bottom-4 bg-ivory border border-mitti/20 p-4 rounded shadow-lg flex items-center justify-between gap-3 flex-wrap">
        <p className="text-mitti text-sm">
          {ready
            ? `${formats.length * styles.length} creative${formats.length * styles.length === 1 ? '' : 's'} (${formats.length} format ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ${styles.length} style) + copy in ~60-90s`
            : 'Complete the steps above to generate'}
        </p>
        <button onClick={generate} disabled={generating || !ready}
          className="bg-kohl text-ivory px-6 py-3 font-ui text-xs tracking-widest flex items-center gap-2 disabled:opacity-50">
          {generating
            ? <><Loader2 className="w-3 h-3 animate-spin" /> GENERATINGÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦</>
            : <><Sparkles className="w-3 h-3" /> GENERATE {Math.max(1, formats.length * styles.length)} VARIANT{(formats.length * styles.length) === 1 ? '' : 'S'}</>
          }
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6 pt-4 border-t border-mitti/20">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl text-kohl">Your creatives</h2>
            {result.diagnostics?.mode && (
              <span className={`text-[10px] font-ui tracking-widest px-2 py-1 ${
                result.diagnostics.mode === 'image-edit'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-haldi/20 text-haldi'
              }`}
                title={result.diagnostics.mode === 'image-edit'
                  ? `Using ${result.diagnostics.referenceImageCount} actual product photo(s) as reference`
                  : 'No product photo found ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â generated from text only'}>
                {result.diagnostics.mode === 'image-edit'
                  ? `ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ PRODUCT-LOCKED (${result.diagnostics.referenceImageCount} ref${result.diagnostics.referenceImageCount === 1 ? '' : 's'})`
                  : 'ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â  TEXT-ONLY (no product photo)'}
              </span>
            )}
          </div>

          {/* Responsive grid ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â cards keep their own aspect ratio per format */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {result.variants.map((v: any, i: number) => {
              const cls = FORMATS.find(f => f.v === v.format)?.cls || 'aspect-square';
              const fLabel = FORMATS.find(f => f.v === v.format)?.l || v.format;
              return (
              <div key={i} className={`relative group border border-mitti/20 rounded overflow-hidden ${cls}`}>
                <img src={v.url} alt={`Variant ${i + 1}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-kohl/0 group-hover:bg-kohl/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <a href={v.url} download={`neejee-studio-${i + 1}.jpg`} target="_blank" rel="noreferrer"
                    className="bg-ivory text-kohl px-3 py-1.5 text-xs tracking-widest font-ui flex items-center gap-1">
                    <Download className="w-3 h-3" /> DOWNLOAD
                  </a>
                  <button onClick={() => saveToAssets(i)}
                    disabled={savedAssets.has(i)}
                    className={`px-3 py-1.5 text-xs tracking-widest font-ui flex items-center gap-1 ${
                      savedAssets.has(i)
                        ? 'bg-emerald-600 text-white'
                        : 'bg-banarasi text-kohl'
                    }`}>
                    {savedAssets.has(i) ? <><Check className="w-3 h-3" /> SAVED</> : <><Save className="w-3 h-3" /> SAVE TO LIBRARY</>}
                  </button>
                </div>
                <span className="absolute top-2 left-2 bg-kohl/80 text-ivory text-[10px] tracking-widest px-2 py-0.5 rounded">
                  {fLabel.toUpperCase()} ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· {String(v.style || '').toUpperCase()}
                </span>
              </div>
              );
            })}
            {result.variants.length === 0 && (
              <div className="col-span-2 md:col-span-3 bg-madder/10 border border-madder p-6 text-madder text-sm space-y-2">
                <div className="font-display">Image generation returned 0 variants.</div>
                {result.diagnostics?.imageError ? (
                  <div className="font-mono text-xs bg-madder/5 p-2 rounded">
                    <strong>Reason:</strong> {result.diagnostics.imageError}
                  </div>
                ) : (
                  <div className="text-xs">No error message returned. Check Vercel logs for [falRun] entries.</div>
                )}
                <div className="text-xs">
                  Common causes: (1) <code>FAL_KEY</code> not set in Vercel env vars, (2) account out of credits,
                  (3) prompt flagged by safety filter, (4) rate-limited. The copy below is still usable.
                </div>
              </div>
            )}
          </div>

          {/* Copy bundle */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CopyBlock title="Instagram caption" text={result.copy.instagramCaption}
              extra={(result.copy.instagramHashtags || []).map((h: string) => `#${h}`).join(' ')} />
            <CopyBlock title="Email subject" text={result.copy.emailSubject}
              extra={`Preheader: ${result.copy.emailPreheader}`} />
            <CopyBlock title="WhatsApp broadcast" text={result.copy.whatsappBroadcast} />
            <CopyBlock title="Call-to-action" text={result.copy.cta} />
          </div>

          {/* Prompt (for reuse) */}
          <details className="bg-beige/30 border border-mitti/20 rounded p-4 text-sm">
            <summary className="font-display text-kohl cursor-pointer">Image prompt used (for re-runs)</summary>
            <p className="text-mitti mt-2 italic">{result.imagePrompt}</p>
          </details>

          <div className="flex gap-2">
            <button onClick={generate} disabled={generating}
              className="border border-banarasi text-banarasi px-4 py-2 font-ui text-xs tracking-widest flex items-center gap-1 disabled:opacity-50">
              <RefreshCw className="w-3 h-3" /> GENERATE AGAIN
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-ivory border border-mitti/20 rounded p-5">
      <h3 className="font-display text-lg text-kohl mb-4 flex items-center gap-3">
        <span className="bg-kohl text-ivory w-7 h-7 rounded-full inline-flex items-center justify-center text-sm">{step}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function ProductPicker({ products, selectedId, onSelect }: { products: any[]; selectedId: string; onSelect: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const filtered = products.filter(p =>
    !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 50);
  return (
    <>
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search products by name or SKUÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦"
        className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory mb-3" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
        {filtered.map(p => (
          <button key={p.id} onClick={() => onSelect(p.id)}
            className={`text-left border rounded overflow-hidden transition-colors ${
              selectedId === p.id ? 'border-kohl ring-2 ring-banarasi/40' : 'border-mitti/20 hover:border-kohl/50'
            }`}>
            {p.images?.[0] && <img src={p.images[0]} alt="" className="w-full aspect-square object-cover" />}
            <div className="p-2">
              <p className="text-xs text-kohl line-clamp-2">{p.name}</p>
              {p.sellingPrice != null && <p className="text-[10px] text-mitti mt-0.5">{formatINR(p.sellingPrice)}</p>}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

function RangePicker({ products, categories, productIds, onProductsChange, categoryId, onCategoryChange }: any) {
  const [tab, setTab] = useState<'products' | 'category'>('products');
  const togglePid = (id: string) => {
    if (productIds.includes(id)) onProductsChange(productIds.filter((x: string) => x !== id));
    else onProductsChange([...productIds, id].slice(0, 8));
  };
  return (
    <div>
      <div className="flex gap-2 mb-3">
        <button onClick={() => setTab('products')}
          className={`px-3 py-1.5 text-xs tracking-widest font-ui ${tab === 'products' ? 'bg-kohl text-ivory' : 'bg-ivory border border-mitti/30 text-mitti'}`}>
          PICK PRODUCTS ({productIds.length}/8)
        </button>
        <button onClick={() => setTab('category')}
          className={`px-3 py-1.5 text-xs tracking-widest font-ui ${tab === 'category' ? 'bg-kohl text-ivory' : 'bg-ivory border border-mitti/30 text-mitti'}`}>
          OR A WHOLE CATEGORY
        </button>
      </div>
      {tab === 'products' ? (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 max-h-72 overflow-y-auto">
          {products.slice(0, 60).map((p: any) => (
            <button key={p.id} onClick={() => togglePid(p.id)}
              className={`text-left border rounded overflow-hidden transition-colors ${
                productIds.includes(p.id) ? 'border-kohl ring-2 ring-banarasi/40' : 'border-mitti/20 hover:border-kohl/50'
              }`}>
              {p.images?.[0] && <img src={p.images[0]} alt="" className="w-full aspect-square object-cover" />}
              <p className="text-[10px] text-kohl p-1 line-clamp-1">{p.name}</p>
            </button>
          ))}
        </div>
      ) : (
        <select value={categoryId} onChange={e => onCategoryChange(e.target.value)}
          className="w-full border border-mitti/30 px-3 py-2 text-sm bg-ivory">
          <option value="">Pick a categoryÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦</option>
          {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
    </div>
  );
}

function OfferPicker({ coupons, couponId, onCouponChange, discountText, onDiscountTextChange }: any) {
  return (
    <div className="space-y-4">
      <div>
        <p className="label text-banarasi mb-1">PICK A COUPON <span className="text-mitti font-normal">ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â or describe the offer below</span></p>
        <select value={couponId} onChange={e => onCouponChange(e.target.value)}
          className="w-full border border-mitti/30 px-3 py-2 text-sm bg-ivory">
          <option value="">No specific coupon</option>
          {coupons.map((c: any) => (
            <option key={c.id} value={c.id}>{c.code} {c.discountType === 'PERCENT' ? `(${c.discountValue}% off)` : `(ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¹${c.discountValue / 100} off)`}</option>
          ))}
        </select>
      </div>
      <div>
        <p className="label text-banarasi mb-1">OR DESCRIBE THE OFFER</p>
        <input value={discountText} onChange={e => onDiscountTextChange(e.target.value)}
          placeholder="e.g. 20% off this weekend, free shipping above ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¹2,500"
          className="w-full border border-mitti/30 px-3 py-2 text-sm bg-ivory" />
      </div>
    </div>
  );
}

function CopyBlock({ title, text, extra }: { title: string; text: string; extra?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const full = extra ? `${text}\n\n${extra}` : text;
    navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="bg-ivory border border-mitti/20 rounded p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="label text-banarasi text-[10px]">{title.toUpperCase()}</p>
        <button onClick={copy} className="text-xs text-banarasi hover:text-kohl flex items-center gap-1">
          {copied ? <><Check className="w-3 h-3" /> COPIED</> : <><Copy className="w-3 h-3" /> COPY</>}
        </button>
      </div>
      <p className="text-kohl text-sm whitespace-pre-wrap">{text}</p>
      {extra && <p className="text-mitti text-xs mt-2 whitespace-pre-wrap italic border-t border-mitti/10 pt-2">{extra}</p>}
    </div>
  );
}
