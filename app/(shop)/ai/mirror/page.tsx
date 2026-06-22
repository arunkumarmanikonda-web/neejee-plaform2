'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Upload, Sparkles, Check, X, Loader2, Camera } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { uploadAiImage } from '@/lib/client-upload';

export const dynamic = 'force-dynamic';

function MirrorInner() {
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
  const [consent, setConsent] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [outputUrl, setOutputUrl] = useState<string>('');
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [stubMessage, setStubMessage] = useState('');
  const [error, setError] = useState('');

  // Auth + eligible products. Preserve ?product= through login redirect.
  useEffect(() => {
    const nextWithProduct = initialProduct
      ? `/ai/mirror?product=${encodeURIComponent(initialProduct)}`
      : '/ai/mirror';
    const loginUrl = `/login?next=${encodeURIComponent(nextWithProduct)}`;

    const checkAuth = async () => {
      // Try twice — first call can race a cold-start cookie read on Vercel
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
    };
    checkAuth();

    fetch('/api/products?limit=60')
      .then(r => r.json())
      .then(d => {
        const list = (d.products || []).filter((p: any) => p.aiTryOnEligible);
        setEligible(list);
        // If ?product= is a slug (not an id), resolve it to the id
        if (initialProduct && !list.find((p: any) => p.id === initialProduct)) {
          const bySlug = list.find((p: any) => p.slug === initialProduct);
          if (bySlug) setSelectedId(bySlug.id);
        }
      })
      .catch(() => {});
  }, [router, initialProduct]);

  const handleFile = async (file: File) => {
    if (file.size > 15 * 1024 * 1024) { setError('Image larger than 15 MB — please pick a smaller one'); return; }
    setError(''); setUploading(true);
    try {
      const { url } = await uploadAiImage(file, 'ai-mirror');
      setPersonImageUrl(url);
      // Always go to the 'select' step so the user sees the consent checkbox
      // and the generate button. When ?product= is passed we just hide the
      // product picker (the product is already chosen).
      setStep('select');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const generate = async () => {
    if (!selectedId || !consent || !personImageUrl) return;
    setGenerating(true); setError(''); setStubMessage('Submitting your portrait…');
    try {
      // Phase 1: submit the job (fast, returns immediately)
      const res = await fetch('/api/ai/mirror', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId: selectedId, personImageUrl, consent: true }),
      });
      const raw = await res.text();
      let j: any = {};
      try { j = raw ? JSON.parse(raw) : {}; } catch {
        throw new Error('Could not reach the mirror. Please try again — the connection slipped.');
      }
      if (!res.ok) {
        const friendly = j.error?.includes('FAL_KEY')
          ? 'AI Mirror is being prepared. Please try again in a moment.'
          : j.hint ? `${j.error}\n\n${j.hint}` : (j.error || 'Generation failed');
        throw new Error(friendly);
      }

      // If the API returns done:true synchronously (stub mode or cache hit), use it
      if (j.done && j.outputUrl) {
        setOutputUrl(j.outputUrl);
        setConfigured(!!j.configured);
        setStubMessage(j.message || '');
        setStep('preview');
        return;
      }

      // Phase 2: poll the status endpoint until done (up to 5 minutes — fal cold starts can be slow)
      if (!j.pollUrl) throw new Error('Mirror returned no poll URL.');
      const pollUrl: string = j.pollUrl;
      const start = Date.now();
      const maxWaitMs = 300_000;  // 5 minutes
      let lastStatus = 'IN_QUEUE';
      let pollCount = 0;
      // Small delay before first poll — fal usually needs ~5s to start
      await new Promise(r => setTimeout(r, 4000));
      while (Date.now() - start < maxWaitMs) {
        pollCount++;
        const sRes = await fetch(pollUrl, { credentials: 'include', cache: 'no-store' });
        const sRaw = await sRes.text();
        let sJ: any = {};
        try { sJ = sRaw ? JSON.parse(sRaw) : {}; } catch { /* keep polling */ }
        if (!sRes.ok) {
          throw new Error(sJ?.error || `Generation failed (status ${sRes.status})`);
        }
        if (sJ.done && sJ.outputUrl) {
          setOutputUrl(sJ.outputUrl);
          setConfigured(true);
          setStep('preview');
          return;
        }
        // Surface fal's current status to the user so they don't feel stuck
        const niceStatus = sJ.status === 'IN_QUEUE'
          ? `Waiting in the queue…${sJ.queuePosition !== undefined ? ` (position ${sJ.queuePosition})` : ''}`
          : sJ.status === 'IN_PROGRESS'
            ? `Mirroring you onto the piece…${sJ.lastLog ? ` — ${sJ.lastLog}` : ''}`
            : `Status: ${sJ.status || 'thinking…'}`;
        setStubMessage(`${niceStatus} (check ${pollCount})`);
        if (sJ.status) lastStatus = sJ.status;
        await new Promise(r => setTimeout(r, 3000));  // poll every 3s
      }
      throw new Error(`The mirror is taking longer than usual (last status: ${lastStatus} after ${pollCount} checks). Sometimes the atelier needs a breath — please try again.`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const reset = () => {
    setPersonImageUrl(''); setSelectedId(''); setConsent(false);
    setOutputUrl(''); setError(''); setStep('upload');
  };

  if (authChecking) {
    return <><Header /><div className="py-32 text-center text-mitti italic">Personal moment…</div><Footer /></>;
  }

  return (
    <>
      <Header />

      <section className="bg-kohl text-ivory py-16 px-6 text-center">
        <p className="text-xs tracking-[0.35em] text-banarasi mb-4">AI MIRROR</p>
        <h1 className="font-display text-5xl md:text-6xl">See it on you.</h1>
        <p className="font-italic italic text-ivory/70 max-w-xl mx-auto mt-4">
          Upload a portrait. Choose a piece. Find what feels personal — privately, before it ships.
        </p>
      </section>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-12 text-[10px] tracking-[0.25em]">
          {['UPLOAD', 'CHOOSE', 'MIRROR'].map((label, i) => {
            const idx = ['upload', 'select', 'preview'].indexOf(step);
            const active = i <= idx;
            return (
              <div key={label} className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center ${active ? 'bg-madder text-ivory' : 'bg-beige text-mitti'}`}>{i + 1}</span>
                <span className={active ? 'text-kohl' : 'text-mitti'}>{label}</span>
                {i < 2 && <span className="w-8 h-px bg-mitti/30 ml-2" />}
              </div>
            );
          })}
        </div>

        {error && <div className="mb-6 p-3 bg-madder/10 border border-madder text-madder text-sm">{error}</div>}

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="text-center">
            <label className="block border-2 border-dashed border-mitti/40 hover:border-kohl bg-beige/30 cursor-pointer p-12 transition-colors">
              <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              {uploading ? (
                <div className="flex items-center justify-center gap-3 text-mitti">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Uploading your portrait…</span>
                </div>
              ) : (
                <>
                  <Camera className="w-10 h-10 text-mitti/60 mx-auto mb-4" />
                  <p className="font-display text-2xl text-kohl">Your portrait</p>
                  <p className="text-sm text-mitti mt-2">Click to choose · JPG / PNG / WebP / HEIC · up to 15 MB</p>
                  <p className="text-[10px] tracking-wider text-mitti/70 mt-3">
                    Best: front-facing, even light, full upper body in frame.
                  </p>
                </>
              )}
            </label>
            <p className="text-[11px] text-mitti/70 mt-6 max-w-md mx-auto leading-relaxed">
              Your image stays private. Used only to generate this preview. Auto-deleted after 30 days. Never shown to anyone but you.
            </p>
          </div>
        )}

        {/* Step 2: Choose product */}
        {step === 'select' && (
          <div>
            <div className="flex items-start gap-6 mb-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={personImageUrl} alt="Your portrait" className="w-32 h-40 object-cover border border-mitti/30" />
              <div className="flex-1">
                <p className="text-xs tracking-wider text-mitti">YOUR PORTRAIT</p>
                <p className="font-display text-lg text-kohl mt-1">Looking good.</p>
                <button onClick={reset} className="text-xs tracking-wider text-madder underline mt-2">Use a different one</button>
              </div>
            </div>

            {/* If a product was pre-selected via ?product=, show it as a chosen card;
                otherwise show the full eligible-pieces picker. */}
            {(() => {
              const preSelected = selectedId ? eligible.find(p => p.id === selectedId) : null;
              if (preSelected) {
                return (
                  <div>
                    <p className="label text-madder mb-3">MIRRORING THIS PIECE</p>
                    <div className="flex items-center gap-4 border border-madder/30 bg-ivory p-3">
                      {preSelected.images?.[0] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preSelected.images[0]} alt={preSelected.name} className="w-20 h-24 object-cover" />
                      )}
                      <div className="flex-1">
                        <p className="font-display text-base text-kohl">{preSelected.name}</p>
                        <p className="text-xs text-mitti tracking-wider mt-1">₹{(preSelected.sellingPrice / 100).toLocaleString('en-IN')}</p>
                        <button
                          onClick={() => setSelectedId('')}
                          className="text-xs tracking-wider text-madder underline mt-2"
                        >
                          Choose a different piece
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div>
                  <p className="label text-madder mb-3">CHOOSE A PIECE TO MIRROR</p>
                  {eligible.length === 0 ? (
                    <p className="text-mitti text-sm">No pieces are AI-Mirror-eligible yet. <Link href="/products" className="underline">Browse the collection</Link>.</p>
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
                            <img src={p.images[0]} alt={p.name} className="w-full aspect-[3/4] object-cover" />
                          )}
                          <div className="p-2">
                            <p className="text-xs font-display text-kohl truncate">{p.name}</p>
                            <p className="text-[10px] text-mitti tracking-wider">₹{(p.sellingPrice / 100).toLocaleString('en-IN')}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            <label className="flex items-start gap-2.5 mt-6 cursor-pointer">
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 accent-madder" />
              <span className="text-xs text-kohl/85 leading-relaxed">
                I consent to NEEJEE using my portrait to generate this preview. I understand it stays private and auto-deletes after 30 days.
              </span>
            </label>

            <button
              onClick={generate}
              disabled={!selectedId || !consent || generating}
              className="btn-primary w-full mt-6 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> MIRRORING…</> : <><Sparkles className="w-4 h-4" /> SHOW ME</>}
            </button>

            {generating && stubMessage && (
              <p className="text-xs text-mitti italic mt-3 text-center">{stubMessage}</p>
            )}
            {generating && (
              <p className="text-xs text-mitti/60 mt-2 text-center">This usually takes 30–90 seconds. Please keep this tab open.</p>
            )}
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 'preview' && (
          <div className="text-center">
            {configured === false && stubMessage && (
              <div className="mb-6 p-3 bg-haldi/10 border border-haldi text-mitti text-sm">{stubMessage}</div>
            )}
            <p className="font-display text-3xl text-kohl mb-6">Your mirror.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={outputUrl} alt="AI Mirror preview" className="max-w-md mx-auto border border-mitti/30 mb-6" />
            <div className="flex items-center justify-center gap-3">
              <button onClick={reset} className="px-6 py-3 border border-kohl text-kohl hover:bg-kohl hover:text-ivory text-xs tracking-wider">TRY ANOTHER</button>
              {selectedId && (
                <Link href={`/products/${eligible.find(p => p.id === selectedId)?.slug || ''}`} className="px-6 py-3 bg-madder text-ivory hover:bg-madder/90 text-xs tracking-wider">
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

export default function MirrorPage() {
  return <Suspense fallback={<div className="min-h-screen bg-ivory" />}><MirrorInner /></Suspense>;
}
