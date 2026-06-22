'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles, Loader2, Home } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { uploadAiImage } from '@/lib/client-upload';

export const dynamic = 'force-dynamic';

function SpaceInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const initialProduct = sp?.get('product') || '';

  const [authChecking, setAuthChecking] = useState(true);
  const [eligible, setEligible] = useState<any[]>([]);
  const [step, setStep] = useState<'upload' | 'select' | 'preview'>('upload');
  const [roomImageUrl, setRoomImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedId, setSelectedId] = useState(initialProduct);
  const [consent, setConsent] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [outputUrl, setOutputUrl] = useState('');
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [stubMessage, setStubMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.email) { router.replace('/login?next=%2Fai%2Fspace'); return; }
        setAuthChecking(false);
      })
      .catch(() => router.replace('/login?next=%2Fai%2Fspace'));
    fetch('/api/products?limit=60')
      .then(r => r.json())
      .then(d => setEligible((d.products || []).filter((p: any) => p.aiRoomEligible)))
      .catch(() => {});
  }, [router]);

  const handleFile = async (file: File) => {
    if (file.size > 15 * 1024 * 1024) { setError('Image larger than 15 MB — please pick a smaller one'); return; }
    setError(''); setUploading(true);
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
    setGenerating(true); setError('');
    try {
      const res = await fetch('/api/ai/space', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId: selectedId, roomImageUrl, consent: true }),
      });
      const j = await res.json();
      if (!res.ok) {
        const friendly = j.error?.includes('FAL_KEY')
          ? 'AI Space is being prepared. Please try again in a moment.'
          : j.hint ? `${j.error}\n\n${j.hint}` : (j.error || 'Generation failed');
        throw new Error(friendly);
      }
      setOutputUrl(j.outputUrl);
      setConfigured(!!j.configured);
      setStubMessage(j.message || '');
      setStep('preview');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const reset = () => { setRoomImageUrl(''); setSelectedId(''); setConsent(false); setOutputUrl(''); setError(''); setStep('upload'); };

  if (authChecking) {
    return <><Header /><div className="py-32 text-center text-mitti italic">Personal moment…</div><Footer /></>;
  }

  return (
    <>
      <Header />

      <section className="bg-mitti text-ivory py-16 px-6 text-center">
        <p className="text-xs tracking-[0.35em] text-banarasi mb-4">AI SPACE</p>
        <h1 className="font-display text-5xl md:text-6xl">See it in your space.</h1>
        <p className="font-italic italic text-ivory/70 max-w-xl mx-auto mt-4">
          Upload a corner of your home. Choose a piece. Find what belongs.
        </p>
      </section>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-center justify-center gap-2 mb-12 text-[10px] tracking-[0.25em]">
          {['UPLOAD', 'CHOOSE', 'PLACE'].map((label, i) => {
            const idx = ['upload', 'select', 'preview'].indexOf(step);
            const active = i <= idx;
            return (
              <div key={label} className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center ${active ? 'bg-mitti text-ivory' : 'bg-beige text-mitti'}`}>{i + 1}</span>
                <span className={active ? 'text-kohl' : 'text-mitti'}>{label}</span>
                {i < 2 && <span className="w-8 h-px bg-mitti/30 ml-2" />}
              </div>
            );
          })}
        </div>

        {error && <div className="mb-6 p-3 bg-madder/10 border border-madder text-madder text-sm">{error}</div>}

        {step === 'upload' && (
          <div className="text-center">
            <label className="block border-2 border-dashed border-mitti/40 hover:border-kohl bg-beige/30 cursor-pointer p-12 transition-colors">
              <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              {uploading ? (
                <div className="flex items-center justify-center gap-3 text-mitti">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Uploading your space…</span>
                </div>
              ) : (
                <>
                  <Home className="w-10 h-10 text-mitti/60 mx-auto mb-4" />
                  <p className="font-display text-2xl text-kohl">Your room</p>
                  <p className="text-sm text-mitti mt-2">Click to choose · JPG / PNG / WebP / HEIC · up to 15 MB</p>
                  <p className="text-[10px] tracking-wider text-mitti/70 mt-3">
                    Best: even daylight, a corner or wall where the piece could live.
                  </p>
                </>
              )}
            </label>
            <p className="text-[11px] text-mitti/70 mt-6 max-w-md mx-auto leading-relaxed">
              Your photo stays private. Used only to generate this preview. Auto-deleted after 30 days.
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
                <p className="font-display text-lg text-kohl mt-1">A lovely space.</p>
                <button onClick={reset} className="text-xs tracking-wider text-madder underline mt-2">Use a different photo</button>
              </div>
            </div>

            <p className="label text-madder mb-3">CHOOSE A PIECE TO PLACE</p>
            {eligible.length === 0 ? (
              <p className="text-mitti text-sm">No pieces are AI-Space-eligible yet. <Link href="/products" className="underline">Browse the collection</Link>.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {eligible.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={`text-left border ${selectedId === p.id ? 'border-madder ring-2 ring-madder/30' : 'border-mitti/20 hover:border-kohl'} bg-ivory`}
                  >
                    {p.images?.[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0]} alt={p.name} className="w-full aspect-square object-cover" />
                    )}
                    <div className="p-2">
                      <p className="text-xs font-display text-kohl truncate">{p.name}</p>
                      <p className="text-[10px] text-mitti tracking-wider">₹{(p.sellingPrice / 100).toLocaleString('en-IN')}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <label className="flex items-start gap-2.5 mt-6 cursor-pointer">
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 accent-madder" />
              <span className="text-xs text-kohl/85 leading-relaxed">
                I consent to NEEJEE using my photo to generate this preview. Stays private, auto-deletes after 30 days.
              </span>
            </label>

            <button onClick={generate} disabled={!selectedId || !consent || generating} className="btn-primary w-full mt-6 flex items-center justify-center gap-2 disabled:opacity-40">
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> PLACING…</> : <><Sparkles className="w-4 h-4" /> SEE IT HERE</>}
            </button>
          </div>
        )}

        {step === 'preview' && (
          <div className="text-center">
            {configured === false && stubMessage && (
              <div className="mb-6 p-3 bg-haldi/10 border border-haldi text-mitti text-sm">{stubMessage}</div>
            )}
            <p className="font-display text-3xl text-kohl mb-6">Welcome home.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={outputUrl} alt="AI Space preview" className="max-w-2xl w-full mx-auto border border-mitti/30 mb-6" />
            <div className="flex items-center justify-center gap-3">
              <button onClick={reset} className="px-6 py-3 border border-kohl text-kohl hover:bg-kohl hover:text-ivory text-xs tracking-wider">TRY ANOTHER</button>
              {selectedId && (
                <Link href={`/products/${eligible.find(p => p.id === selectedId)?.slug || ''}`} className="px-6 py-3 bg-mitti text-ivory hover:bg-mitti/90 text-xs tracking-wider">
                  VIEW THIS PIECE →
                </Link>
              )}
            </div>
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
