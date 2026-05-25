'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { products, formatPrice } from '@/lib/data';
import { Upload, Sparkles, Check, X } from 'lucide-react';

export default function MirrorPage() {
  const eligible = products.filter(p => p.aiTryOnEligible);
  const [step, setStep] = useState<'upload' | 'select' | 'preview'>('upload');
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setUserPhoto(reader.result as string);
      setStep('select');
    };
    reader.readAsDataURL(file);
  };

  const generate = async () => {
    if (!selectedProduct || !consent) return;
    setGenerating(true);
    try {
      const product = products.find(p => p.id === selectedProduct);
      const res = await fetch('/api/ai/mirror', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: selectedProduct, userPhoto: '<truncated>', consent: true }),
      });
      const data = await res.json();
      // In dev: just show the product image as the "preview"
      setPreviewUrl(data.outputImage || product?.images[0] || null);
      setStep('preview');
    } catch {
      alert('Preview generation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const reset = () => {
    setStep('upload'); setUserPhoto(null); setSelectedProduct(null); setPreviewUrl(null); setConsent(false);
  };

  return (
    <>
      <Header />
      <section className="max-w-8xl mx-auto px-6 lg:px-12 py-12">
        <div className="text-center">
          <p className="label text-madder mb-4"><Sparkles className="w-3 h-3 inline mr-2" />NEEJEE AI</p>
          <h1 className="font-display text-5xl text-kohl">The NEEJEE Mirror</h1>
          <p className="font-italic italic text-xl text-mitti mt-4">See how it may live on you.</p>
          <div className="madder-divider mx-auto mt-8"></div>
        </div>

        <div className="max-w-5xl mx-auto mt-16 grid lg:grid-cols-2 gap-12">
          {/* LEFT — preview */}
          <div className="aspect-[3/4] bg-beige relative overflow-hidden border border-mitti/20">
            {previewUrl ? (
              <Image src={previewUrl} alt="AI preview" fill className="object-cover" />
            ) : userPhoto ? (
              <img src={userPhoto} alt="You" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-mitti">
                <Upload className="w-12 h-12 mb-4 opacity-40" />
                <p className="font-italic italic">Your preview will appear here</p>
              </div>
            )}
            {generating && (
              <div className="absolute inset-0 bg-kohl/80 flex flex-col items-center justify-center text-ivory">
                <Sparkles className="w-12 h-12 animate-pulse" />
                <p className="font-italic italic text-xl mt-4">Weaving your preview...</p>
                <p className="label text-banarasi mt-2">10–20 SECONDS</p>
              </div>
            )}
          </div>

          {/* RIGHT — controls */}
          <div className="space-y-8">
            {step === 'upload' && (
              <>
                <div>
                  <p className="label text-madder">STEP 1 OF 3</p>
                  <h2 className="font-display text-3xl text-kohl mt-2">Upload your photo</h2>
                  <p className="font-italic italic text-mitti mt-2">Front-facing, soft daylight, single colour background.</p>
                </div>
                <label className="block border-2 border-dashed border-mitti/40 p-12 text-center cursor-pointer hover:border-madder transition-colors">
                  <Upload className="w-8 h-8 mx-auto text-mitti" />
                  <p className="font-ui text-sm mt-4 text-kohl">CLICK TO UPLOAD</p>
                  <p className="label mt-2">JPG · PNG · MAX 5MB</p>
                  <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                </label>
                <div className="p-4 bg-beige border-l-2 border-madder text-sm font-body text-kohl/85">
                  <p className="font-medium">Your privacy is sacred.</p>
                  <p className="mt-1">Your photo is encrypted, never sold, auto-deleted in 30 days. You can delete it anytime from your account.</p>
                </div>
              </>
            )}

            {step === 'select' && (
              <>
                <div>
                  <p className="label text-madder">STEP 2 OF 3</p>
                  <h2 className="font-display text-3xl text-kohl mt-2">Choose a piece</h2>
                </div>
                <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
                  {eligible.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProduct(p.id)}
                      className={`text-left border-2 transition-colors ${selectedProduct === p.id ? 'border-madder' : 'border-transparent'}`}
                    >
                      <div className="aspect-square bg-beige relative">
                        {p.images[0] && <Image src={p.images[0]} alt="" fill className="object-cover" />}
                        {selectedProduct === p.id && (
                          <div className="absolute top-2 right-2 w-6 h-6 bg-madder text-ivory rounded-full flex items-center justify-center"><Check className="w-3 h-3" /></div>
                        )}
                      </div>
                      <p className="font-display text-sm mt-2 text-kohl">{p.name}</p>
                      <p className="font-ui text-xs text-monsoon">{formatPrice(p.sellingPrice)}</p>
                    </button>
                  ))}
                </div>
                <label className="flex gap-3 items-start cursor-pointer">
                  <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1" />
                  <span className="font-body text-sm text-kohl/85">I consent to NEEJEE generating an AI preview using my photo. I understand it is auto-deleted in 30 days and is for personal use only.</span>
                </label>
                <div className="flex gap-3">
                  <button onClick={reset} className="btn-outline">START OVER</button>
                  <button onClick={generate} disabled={!selectedProduct || !consent} className="btn-primary flex-1 disabled:opacity-50">
                    GENERATE PREVIEW ✦
                  </button>
                </div>
              </>
            )}

            {step === 'preview' && (
              <>
                <div>
                  <p className="label text-madder">YOUR PREVIEW</p>
                  <h2 className="font-display text-3xl text-kohl mt-2">How it may live on you.</h2>
                  <p className="font-italic italic text-mitti mt-2">A guidance, not a guarantee. Fabric falls differently on every body — that is the point.</p>
                </div>
                {selectedProduct && (() => {
                  const p = products.find(x => x.id === selectedProduct)!;
                  return (
                    <div className="bg-beige p-6">
                      <p className="font-display text-2xl">{p.name}</p>
                      <p className="font-italic italic text-mitti mt-1">{p.poeticLine}</p>
                      <p className="font-display text-3xl text-kohl mt-4">{formatPrice(p.sellingPrice)}</p>
                      <div className="flex gap-3 mt-6">
                        <Link href={`/products/${p.slug}`} className="btn-outline flex-1 text-center">VIEW DETAILS</Link>
                        <Link href={`/products/${p.slug}`} className="btn-primary flex-1 text-center">ADD TO CART</Link>
                      </div>
                    </div>
                  );
                })()}
                <button onClick={reset} className="font-ui text-xs tracking-widest text-mitti hover:text-madder">
                  <X className="w-3 h-3 inline mr-1" /> TRY ANOTHER PIECE
                </button>
              </>
            )}
          </div>
        </div>

        {/* HOW IT WORKS */}
        <div className="max-w-6xl mx-auto mt-32">
          <p className="label text-madder text-center">HOW THE MIRROR WORKS</p>
          <h2 className="font-display text-4xl text-kohl text-center mt-3">Three steps. Twelve seconds.</h2>
          <div className="grid md:grid-cols-3 gap-8 mt-12">
            {[
              { n: '01', t: 'UPLOAD', d: 'A single front-facing photo. Soft daylight. Single colour background.' },
              { n: '02', t: 'CHOOSE', d: 'Pick a piece — saree, dupatta, jhumkas, pashmina. Anything marked ✦.' },
              { n: '03', t: 'PREVIEW', d: 'Our model weaves you and the piece together. 10–20 seconds.' },
            ].map(s => (
              <div key={s.n} className="text-center">
                <p className="font-display text-6xl text-mitti/30">{s.n}</p>
                <p className="label text-madder mt-4">{s.t}</p>
                <p className="font-italic italic text-mitti mt-3">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
