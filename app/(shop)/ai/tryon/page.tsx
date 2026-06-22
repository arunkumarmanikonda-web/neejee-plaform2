'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Upload, Sparkles, Check, Loader2, Camera, Share2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { uploadAiImage } from '@/lib/client-upload';

export const dynamic = 'force-dynamic';

const TYPE_OPTIONS = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'earrings', label: 'Earrings' },
  { value: 'necklace', label: 'Necklace' },
  { value: 'bangle', label: 'Bangle / Bracelet' },
  { value: 'ring', label: 'Ring' },
];

function TryOnInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const initialProduct = sp?.get('product') || '';

  const [me, setMe] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [eligible, setEligible] = useState<any[]>([]);
  const [step, setStep] = useState<'upload' | 'select' | 'preview'>('upload');
  const [personImageUrl, setPersonImageUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(initialProduct);
  const [jewelleryType, setJewelleryType] = useState<string>('auto');
  const [consent, setConsent] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [outputUrl, setOutputUrl] = useState<string>('');
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [stubMessage, setStubMessage] = useState('');
  const [error, setError] = useState('');

  // Auth check
  useEffect(() => {
    const nextWithProduct = initialProduct
      ? `/ai/tryon?product=${encodeURIComponent(initialProduct)}`
      : '/ai/tryon';
    const loginUrl = `/login?next=${encodeURIComponent(nextWithProduct)}`;

    (async () => {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const r = await fetch('/api/me', { credentials: 'include', cache: 'no-store' });
          if (r.ok) {
            const d = await r.json();
            if (d?.email) { setMe(d); setAuthChecking(false); return; }
          }
        } catch {}
        if (attempt === 1) await new Promise(res => setTimeout(res, 800));
      }
      router.replace(loginUrl);
    })();
  }, [router, initialProduct]);

  // Load eligible jewellery products
  useEffect(() => {
    if (!me) return;
    fetch('/api/products?arEligible=true', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.products) setEligible(d.products);
      })
      .catch(() => {});
  }, [me]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const { url } = await uploadAiImage(file, 'ai-tryon');
      setPersonImageUrl(url);
      setStep('select');
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const generate = async () => {
    if (!selectedId) { setError('Please choose a piece first'); return; }
    if (!consent) { setError('Please agree to the AI consent terms'); return; }
    setError('');
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/jewellery-tryon', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedId,
          personImageUrl,
          consent: true,
          jewelleryType,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || 'Generation failed');
        return;
      }
      setOutputUrl(d.outputUrl);
      setConfigured(d.configured !== false);
      if (d.configured === false) setStubMessage(d.message || '');
      setStep('preview');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const reset = () => {
    setStep('upload');
    setPersonImageUrl('');
    setOutputUrl('');
    setSelectedId(initialProduct);
    setConsent(false);
    setError('');
    setStubMessage('');
  };

  const shareWhatsApp = () => {
    const selected = eligible.find(p => p.id === selectedId);
    const productName = selected?.name || 'this piece';
    const productUrl = selected?.slug
      ? `${window.location.origin}/products/${selected.slug}`
      : window.location.origin;
    const text = `Trying on the ${productName} from NEEJEE. Personal Indian craft. ${productUrl}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const downloadResult = () => {
    if (!outputUrl) return;
    const link = document.createElement('a');
    link.href = outputUrl;
    link.download = `neejee-tryon-${Date.now()}.jpg`;
    link.target = '_blank';
    link.click();
  };

  if (authChecking) {
    return (
      <>
        <Header />
        <main className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-mitti" />
        </main>
        <Footer />
      </>
    );
  }

  const selected = eligible.find(p => p.id === selectedId);

  return (
    <>
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <p className="label text-madder">NEEJEE · AR TRY-ON</p>
        <h1 className="font-display text-4xl text-kohl mt-2">See it on you.</h1>
        <p className="italic text-mitti mt-2 max-w-xl">
          Upload a portrait. We&apos;ll place the piece — earrings, necklace, bangle, ring — gently
          and faithfully. A quiet way to imagine before you commit.
        </p>
        <div className="madder-divider mt-4"></div>

        {error && (
          <div className="mt-6 p-3 bg-madder/10 border border-madder text-madder text-sm">
            {error}
          </div>
        )}

        {/* STEP: UPLOAD */}
        {step === 'upload' && (
          <section className="mt-8">
            <h2 className="font-display text-2xl text-kohl mb-3">1. A clear portrait</h2>
            <p className="text-sm text-mitti mb-4">
              Face-forward, neckline visible, good light. The clearer the portrait, the better
              the piece sits.
            </p>
            <label className="block border-2 border-dashed border-mitti/40 hover:border-madder/60 transition-colors p-12 text-center cursor-pointer">
              <input
                type="file"
                accept="image/*"
                capture="user"
                onChange={onUpload}
                disabled={uploading}
                className="hidden"
              />
              {uploading ? (
                <div className="flex items-center justify-center gap-2 text-mitti">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Uploading…
                </div>
              ) : (
                <div className="text-mitti">
                  <Camera className="w-10 h-10 mx-auto mb-3 text-mitti/60" />
                  <p className="font-display text-lg text-kohl">Choose a portrait</p>
                  <p className="text-xs mt-1">Take a photo or pick one from your library</p>
                </div>
              )}
            </label>
          </section>
        )}

        {/* STEP: SELECT */}
        {step === 'select' && (
          <section className="mt-8">
            <div className="flex items-start gap-4 mb-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={personImageUrl} alt="Your portrait" className="w-24 h-24 object-cover" />
              <div className="flex-1">
                <p className="text-xs uppercase tracking-widest text-mitti">Your portrait</p>
                <button onClick={reset} className="text-xs underline text-madder mt-1">
                  Use a different one
                </button>
              </div>
            </div>

            <h2 className="font-display text-2xl text-kohl mb-3">2. The piece</h2>
            {selected ? (
              <div className="flex items-center gap-4 p-4 border border-madder/40 bg-beige/20 mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selected.images?.[0]} alt={selected.name} className="w-20 h-20 object-cover" />
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-widest text-madder">Trying this piece</p>
                  <p className="font-display text-kohl">{selected.name}</p>
                </div>
                <button
                  onClick={() => { setSelectedId(''); }}
                  className="text-xs text-mitti hover:text-madder underline"
                >
                  Change
                </button>
              </div>
            ) : eligible.length === 0 ? (
              <p className="text-sm italic text-mitti">
                No jewellery pieces are currently AR-enabled. Visit the catalog and look for the
                AR TRY-ON badge.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                {eligible.slice(0, 9).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className="text-left border border-mitti/20 hover:border-madder/60 p-2 transition-colors"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.images?.[0]} alt={p.name} className="w-full aspect-square object-cover" />
                    <p className="text-xs mt-2 text-kohl truncate">{p.name}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Type override */}
            <div className="mt-2 mb-4">
              <label className="text-[10px] uppercase tracking-widest text-mitti block mb-1">
                Piece type (auto-detected; override if needed)
              </label>
              <select
                value={jewelleryType}
                onChange={e => setJewelleryType(e.target.value)}
                className="w-full p-2 bg-ivory border border-mitti/20 text-sm"
              >
                {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <label className="flex items-start gap-2 text-sm font-ui mt-6 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
                className="mt-1"
              />
              <span className="text-mitti text-xs leading-relaxed">
                I understand this is an AI-generated preview. NEEJEE will keep my portrait for 30 days
                to deliver this preview, then it will be deleted automatically. No piece is sold based
                on this preview alone — please review the actual product photographs.
              </span>
            </label>

            <button
              onClick={generate}
              disabled={!selectedId || !consent || generating}
              className="mt-6 w-full sm:w-auto px-8 py-3 bg-kohl text-ivory text-xs uppercase tracking-widest hover:bg-madder disabled:opacity-40 inline-flex items-center gap-2"
            >
              {generating
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Placing the piece…</>
                : <><Sparkles className="w-4 h-4" /> Try it on</>}
            </button>

            {generating && (
              <p className="text-xs italic text-mitti mt-3">
                The atelier is at work. Usually 30-60 seconds. Please keep this tab open.
              </p>
            )}
          </section>
        )}

        {/* STEP: PREVIEW */}
        {step === 'preview' && (
          <section className="mt-8">
            <h2 className="font-display text-2xl text-kohl mb-3">A first sight.</h2>
            {stubMessage && (
              <p className="text-sm italic text-mitti mb-3">{stubMessage}</p>
            )}
            {outputUrl && (
              <div className="border border-mitti/20 bg-beige/20 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={outputUrl} alt="Try-on preview" className="w-full max-h-[70vh] object-contain" />
              </div>
            )}

            <div className="flex flex-wrap gap-3 mt-6">
              {selected && (
                <Link
                  href={`/products/${selected.slug}`}
                  className="px-4 py-2 bg-kohl text-ivory text-xs uppercase tracking-widest hover:bg-madder inline-flex items-center gap-2"
                >
                  <Check className="w-4 h-4" /> View {selected.name}
                </Link>
              )}
              {configured && outputUrl && (
                <button
                  onClick={shareWhatsApp}
                  className="px-4 py-2 border border-neem text-neem text-xs uppercase tracking-widest hover:bg-neem/10 inline-flex items-center gap-2"
                >
                  <Share2 className="w-4 h-4" /> Share on WhatsApp
                </button>
              )}
              {configured && outputUrl && (
                <button
                  onClick={downloadResult}
                  className="px-4 py-2 border border-mitti/40 text-kohl text-xs uppercase tracking-widest hover:bg-mitti/10 inline-flex items-center gap-2"
                >
                  <Upload className="w-4 h-4 rotate-180" /> Save image
                </button>
              )}
              <button
                onClick={reset}
                className="px-4 py-2 border border-mitti/40 text-mitti text-xs uppercase tracking-widest hover:bg-mitti/10"
              >
                Try another piece
              </button>
            </div>

            <p className="text-xs italic text-mitti mt-6 max-w-xl">
              AI-generated preview. Drape, tone, and stone-cut on the actual piece may sit
              differently. Always trust the product photographs.
            </p>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}

export default function TryOnPage() {
  return (
    <Suspense fallback={<><Header /><main className="min-h-[60vh]" /><Footer /></>}>
      <TryOnInner />
    </Suspense>
  );
}
