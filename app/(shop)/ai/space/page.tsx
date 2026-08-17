'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles, Loader2, Home } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { uploadAiImage } from '@/lib/client-upload';
import { AiCommerceCompletion } from '@/components/ai/AiCommerceCompletion';
import { DeleteAiPreviewButton } from '@/components/ai/DeleteAiPreviewButton';

export const dynamic = 'force-dynamic';

function SpaceInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const initialProduct = sp?.get('product') || '';
  const initialVariant = sp?.get('variant') || '';

  const [authChecking, setAuthChecking] = useState(true);
  const [eligible, setEligible] = useState<any[]>([]);
  const [step, setStep] = useState<'upload' | 'select' | 'preview'>('upload');
  const [roomImageUrl, setRoomImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedId, setSelectedId] = useState(initialProduct);
  const [selectedVariantId, setSelectedVariantId] = useState(initialVariant);
  const [consent, setConsent] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [outputUrl, setOutputUrl] = useState('');
  const [previewId, setPreviewId] = useState('');
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [stubMessage, setStubMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const query = new URLSearchParams();
    if (initialProduct) query.set('product', initialProduct);
    if (initialVariant) query.set('variant', initialVariant);
    const nextWithSelection = query.toString() ? `/ai/space?${query.toString()}` : '/ai/space';

    fetch('/api/me', { credentials: 'include', cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!data?.email) {
          router.replace(`/login?next=${encodeURIComponent(nextWithSelection)}`);
          return;
        }
        setAuthChecking(false);
      })
      .catch(() => router.replace(`/login?next=${encodeURIComponent(nextWithSelection)}`));

    fetch('/api/products?limit=60')
      .then(response => response.json())
      .then(data => {
        const list = (data.products || []).filter((product: any) => product.aiRoomEligible);
        setEligible(list);
        if (initialProduct && !list.find((product: any) => product.id === initialProduct)) {
          const bySlug = list.find((product: any) => product.slug === initialProduct);
          if (bySlug) setSelectedId(bySlug.id);
        }
      })
      .catch(() => {});
  }, [router, initialProduct, initialVariant]);

  const handleFile = async (file: File) => {
    if (file.size > 15 * 1024 * 1024) {
      setError('Image larger than 15 MB. Please choose a smaller one.');
      return;
    }
    setError('');
    setUploading(true);
    try {
      const { url } = await uploadAiImage(file, 'ai-space');
      setRoomImageUrl(url);
      setStep('select');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const generate = async () => {
    if (!selectedId || !consent || !roomImageUrl) return;
    setGenerating(true);
    setError('');
    try {
      const response = await fetch('/api/ai/space', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId: selectedId, roomImageUrl, consent: true }),
      });
      const data = await response.json();
      if (!response.ok) {
        const friendly = data.error?.includes('FAL_KEY')
          ? 'AI Space is being prepared. Please try again in a moment.'
          : data.hint ? `${data.error}\n\n${data.hint}` : (data.error || 'Generation failed');
        throw new Error(friendly);
      }
      if (data.previewId) setPreviewId(String(data.previewId));
      setOutputUrl(data.outputUrl);
      setConfigured(!!data.configured);
      setStubMessage(data.message || '');
      setStep('preview');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const reset = () => {
    setRoomImageUrl('');
    setSelectedId('');
    setSelectedVariantId('');
    setConsent(false);
    setOutputUrl('');
    setPreviewId('');
    setError('');
    setStep('upload');
  };

  const afterDelete = () => {
    setRoomImageUrl('');
    setOutputUrl('');
    setPreviewId('');
    setConsent(false);
    setStep('upload');
  };

  if (authChecking) {
    return <><Header /><div className="py-32 text-center text-mitti italic">Personal moment…</div><Footer /></>;
  }

  const selectedProduct = selectedId ? eligible.find(product => product.id === selectedId) : null;

  return (
    <>
      <Header />

      <section className="bg-mitti text-ivory py-16 px-6 text-center">
        <p className="text-xs tracking-[0.35em] text-banarasi mb-4">THE NEEJEE SPACE</p>
        <h1 className="font-display text-5xl md:text-6xl">Place it personally.</h1>
        <p className="font-italic italic text-ivory/70 max-w-xl mx-auto mt-4">
          See an object within your own room, then build the setting around what belongs.
        </p>
      </section>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center justify-center gap-2 mb-12 text-[10px] tracking-[0.25em]">
          {['UPLOAD', 'CHOOSE', 'PLACE'].map((label, index) => {
            const current = ['upload', 'select', 'preview'].indexOf(step);
            const active = index <= current;
            return (
              <div key={label} className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center ${active ? 'bg-mitti text-ivory' : 'bg-beige text-mitti'}`}>{index + 1}</span>
                <span className={active ? 'text-kohl' : 'text-mitti'}>{label}</span>
                {index < 2 && <span className="w-8 h-px bg-mitti/30 ml-2" />}
              </div>
            );
          })}
        </div>

        {error && <div className="mb-6 p-3 bg-madder/10 border border-madder text-madder text-sm">{error}</div>}

        {step === 'upload' && (
          <div className="text-center">
            <label className="block border-2 border-dashed border-mitti/40 hover:border-kohl bg-beige/30 cursor-pointer p-12 transition-colors">
              <input type="file" accept="image/*" className="hidden" onChange={event => event.target.files?.[0] && handleFile(event.target.files[0])} />
              {uploading ? (
                <div className="flex items-center justify-center gap-3 text-mitti">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Uploading your space…</span>
                </div>
              ) : (
                <>
                  <Home className="w-10 h-10 text-mitti/60 mx-auto mb-4" />
                  <p className="font-display text-2xl text-kohl">Your room</p>
                  <p className="text-sm text-mitti mt-2">JPG / PNG / WebP / HEIC · up to 15 MB</p>
                  <p className="text-[10px] tracking-wider text-mitti/70 mt-3">Best: even daylight and enough of the room to understand proportion.</p>
                </>
              )}
            </label>
            <p className="text-[11px] text-mitti/70 mt-6 max-w-md mx-auto leading-relaxed">
              Your room image is used for this private preview. You can delete the uploaded image and preview directly after generation.
            </p>
          </div>
        )}

        {step === 'select' && (
          <div>
            <div className="flex items-start gap-6 mb-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={roomImageUrl} alt="Your room" className="w-40 h-32 object-cover border border-mitti/30" />
              <div className="flex-1">
                <p className="text-xs tracking-wider text-mitti">YOUR ROOM</p>
                <p className="font-display text-lg text-kohl mt-1">Ready for placement.</p>
                <button onClick={reset} className="text-xs tracking-wider text-madder underline mt-2">Use a different photo</button>
              </div>
            </div>

            {selectedProduct ? (
              <div>
                <p className="label text-madder mb-3">PLACING THIS PIECE</p>
                <div className="flex items-center gap-4 border border-madder/30 bg-ivory p-3">
                  {selectedProduct.images?.[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedProduct.images[0]} alt={selectedProduct.name} className="w-24 h-24 object-cover" />
                  )}
                  <div className="flex-1">
                    <p className="font-display text-base text-kohl">{selectedProduct.name}</p>
                    <p className="text-xs text-mitti tracking-wider mt-1">₹{(selectedProduct.sellingPrice / 100).toLocaleString('en-IN')}</p>
                    <button
                      onClick={() => { setSelectedId(''); setSelectedVariantId(''); }}
                      className="text-xs tracking-wider text-madder underline mt-2"
                    >
                      Choose a different piece
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <p className="label text-madder mb-3">CHOOSE A PIECE TO PLACE</p>
                {eligible.length === 0 ? (
                  <p className="text-mitti text-sm">No pieces are AI-Space-eligible yet. <Link href="/products" className="underline">Browse the collection</Link>.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {eligible.map(product => (
                      <button
                        key={product.id}
                        onClick={() => { setSelectedId(product.id); setSelectedVariantId(''); }}
                        className={`text-left border ${selectedId === product.id ? 'border-madder ring-2 ring-madder/30' : 'border-mitti/20 hover:border-kohl'} bg-ivory`}
                      >
                        {product.images?.[0] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.images[0]} alt={product.name} className="w-full aspect-square object-cover" />
                        )}
                        <div className="p-2">
                          <p className="text-xs font-display text-kohl truncate">{product.name}</p>
                          <p className="text-[10px] text-mitti tracking-wider">₹{(product.sellingPrice / 100).toLocaleString('en-IN')}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <label className="flex items-start gap-2.5 mt-6 cursor-pointer">
              <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1 accent-madder" />
              <span className="text-xs text-kohl/85 leading-relaxed">
                I consent to NEEJEE processing my room image to generate this private AI preview and understand that scale, colour, material and placement may differ from the physical piece.
              </span>
            </label>

            <button onClick={generate} disabled={!selectedId || !consent || generating} className="btn-primary w-full mt-6 flex items-center justify-center gap-2 disabled:opacity-40">
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> PLACING…</> : <><Sparkles className="w-4 h-4" /> SEE IT HERE</>}
            </button>
          </div>
        )}

        {step === 'preview' && (
          <div>
            {configured === false && stubMessage && (
              <div className="mb-6 p-3 bg-haldi/10 border border-haldi text-mitti text-sm">{stubMessage}</div>
            )}
            <div className="text-center">
              <p className="font-display text-3xl text-kohl mb-2">Welcome home.</p>
              <p className="font-italic italic text-mitti text-sm mb-6">Scale and material are an AI approximation.</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={outputUrl} alt="AI Space preview" className="max-w-2xl w-full mx-auto border border-mitti/30 mb-6" />
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button onClick={reset} className="px-6 py-3 border border-kohl text-kohl hover:bg-kohl hover:text-ivory text-xs tracking-wider">TRY ANOTHER</button>
                {selectedProduct && (
                  <Link href={`/products/${selectedProduct.slug}`} className="px-6 py-3 border border-mitti/30 text-kohl hover:border-madder text-xs tracking-wider">
                    VIEW PIECE
                  </Link>
                )}
              </div>
              <DeleteAiPreviewButton previewId={previewId} onDeleted={afterDelete} />
            </div>

            {selectedProduct && (
              <AiCommerceCompletion
                mode="space"
                sourceProduct={selectedProduct}
                sourceVariantId={selectedVariantId || null}
              />
            )}
          </div>
        )}
      </div>

      <Footer />
    </>
  );
}

export default function SpacePage() {
  return <Suspense fallback={<div className="min-h-screen bg-ivory" />}><SpaceInner /></Suspense>;
}
