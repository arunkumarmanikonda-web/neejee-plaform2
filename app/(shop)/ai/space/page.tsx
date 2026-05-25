'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { products, formatPrice } from '@/lib/data';
import { Upload, Sparkles } from 'lucide-react';

export default function SpacePage() {
  const eligible = products.filter(p => p.aiRoomEligible || p.categorySlug === 'home');
  const [roomPhoto, setRoomPhoto] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <>
      <Header />
      <section className="max-w-8xl mx-auto px-6 lg:px-12 py-12">
        <div className="text-center">
          <p className="label text-madder mb-4"><Sparkles className="w-3 h-3 inline mr-2" />NEEJEE AI</p>
          <h1 className="font-display text-5xl text-kohl">NEEJEE Space</h1>
          <p className="font-italic italic text-xl text-mitti mt-4">See how it lives in yours.</p>
          <div className="madder-divider mx-auto mt-8"></div>
        </div>

        <div className="max-w-5xl mx-auto mt-16 grid lg:grid-cols-2 gap-12">
          <div className="aspect-square bg-beige border border-mitti/20 relative">
            {roomPhoto ? (
              <img src={roomPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-mitti">
                <Image src="https://www.genspark.ai/api/files/s/VthqGhRC?cache_control=3600" alt="" fill className="object-cover opacity-60" />
              </div>
            )}
          </div>
          <div className="space-y-8">
            <div>
              <p className="label text-madder">STEP 1</p>
              <h2 className="font-display text-3xl text-kohl mt-2">Upload your room</h2>
              <p className="font-italic italic text-mitti mt-2">A corner, a console, an empty wall.</p>
            </div>
            <label className="block border-2 border-dashed border-mitti/40 p-10 text-center cursor-pointer hover:border-madder">
              <Upload className="w-8 h-8 mx-auto text-mitti" />
              <p className="font-ui text-sm mt-4">CLICK TO UPLOAD ROOM PHOTO</p>
              <input type="file" accept="image/*" className="hidden" onChange={e => {
                const f = e.target.files?.[0]; if (!f) return;
                const r = new FileReader(); r.onload = () => setRoomPhoto(r.result as string); r.readAsDataURL(f);
              }} />
            </label>
            <div>
              <p className="label text-madder">STEP 2 — CHOOSE AN OBJECT</p>
              <div className="grid grid-cols-3 gap-2 mt-3">
                {eligible.slice(0, 6).map(p => (
                  <button key={p.id} onClick={() => setSelected(p.id)} className={`border-2 ${selected === p.id ? 'border-madder' : 'border-transparent'}`}>
                    <div className="aspect-square bg-beige relative">
                      {p.images[0] && <Image src={p.images[0]} alt="" fill className="object-cover" />}
                    </div>
                    <p className="font-ui text-[10px] mt-1 text-kohl">{p.name}</p>
                  </button>
                ))}
              </div>
            </div>
            <button disabled={!roomPhoto || !selected} className="btn-primary w-full disabled:opacity-50">PLACE IN MY SPACE ✦</button>
            <p className="label text-monsoon">PRIVACY-FIRST · AUTO-DELETED IN 30 DAYS · YOUR CONSENT REQUIRED</p>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
