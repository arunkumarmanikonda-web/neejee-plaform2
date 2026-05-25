'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { products, formatPrice } from '@/lib/data';
import { Sparkles } from 'lucide-react';

type Step = 'whom' | 'occasion' | 'budget' | 'taste' | 'results';

export default function GiftConciergePage() {
  const [step, setStep] = useState<Step>('whom');
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const set = (k: string, v: string) => setAnswers(prev => ({ ...prev, [k]: v }));

  const next = () => {
    const flow: Step[] = ['whom', 'occasion', 'budget', 'taste', 'results'];
    setStep(flow[flow.indexOf(step) + 1]);
  };

  // Mock matching logic — production: LLM call
  const recommendations = products.filter(p => p.badges.includes('FOUNDER\'S EDIT')).slice(0, 3);

  return (
    <>
      <Header />
      <section className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-center">
          <p className="label text-madder mb-4"><Sparkles className="w-3 h-3 inline mr-2" />NEEJEE GIFT CONCIERGE</p>
          <h1 className="font-display text-5xl text-kohl">A gift, personally chosen.</h1>
          <p className="font-italic italic text-xl text-mitti mt-4">Four questions. One trunk.</p>
          <div className="madder-divider mx-auto mt-8"></div>
        </div>

        <div className="bg-beige p-10 mt-16 min-h-[400px]">
          {step === 'whom' && (
            <Question title="For whom?" options={['Mother', 'Wife / Partner', 'Sister', 'Daughter', 'Father / Brother', 'Friend']} onSelect={v => { set('whom', v); next(); }} />
          )}
          {step === 'occasion' && (
            <Question title="What occasion?" options={['Wedding', 'Anniversary', 'Birthday', 'Diwali / Festive', 'Karwa Chauth', 'Just because']} onSelect={v => { set('occasion', v); next(); }} />
          )}
          {step === 'budget' && (
            <Question title="Comfortable budget?" options={['Under ₹5,000', '₹5,000 – ₹15,000', '₹15,000 – ₹50,000', '₹50,000 – ₹1L', 'Above ₹1L · Heirloom']} onSelect={v => { set('budget', v); next(); }} />
          )}
          {step === 'taste' && (
            <Question title="Her taste?" options={['Quiet, minimal', 'Classic, traditional', 'Bold, statement', 'Modern, contemporary', 'Heirloom collector']} onSelect={v => { set('taste', v); next(); }} />
          )}

          {step === 'results' && (
            <>
              <p className="label text-madder text-center">PERSONALLY MATCHED</p>
              <h2 className="font-display text-3xl text-kohl text-center mt-3">Three found, for {answers.whom?.toLowerCase()}.</h2>
              <p className="font-italic italic text-mitti text-center mt-2">{answers.occasion} · {answers.budget} · {answers.taste}</p>
              <div className="madder-divider mx-auto mt-6"></div>
              <div className="grid md:grid-cols-3 gap-4 mt-8">
                {recommendations.map(p => (
                  <Link key={p.id} href={`/products/${p.slug}`} className="group">
                    <div className="aspect-[3/4] bg-ivory relative">
                      {p.images[0] && <Image src={p.images[0]} alt="" fill className="object-cover" />}
                    </div>
                    <p className="font-display text-base mt-3 group-hover:text-madder">{p.name}</p>
                    <p className="font-italic italic text-mitti text-sm mt-1">{p.poeticLine}</p>
                    <p className="font-display text-lg text-kohl mt-1">{formatPrice(p.sellingPrice)}</p>
                  </Link>
                ))}
              </div>
              <div className="text-center mt-10">
                <button onClick={() => { setStep('whom'); setAnswers({}); }} className="btn-outline">START OVER</button>
              </div>
            </>
          )}
        </div>
      </section>
      <Footer />
    </>
  );
}

function Question({ title, options, onSelect }: { title: string; options: string[]; onSelect: (v: string) => void }) {
  return (
    <>
      <h2 className="font-display text-3xl text-kohl text-center">{title}</h2>
      <div className="grid grid-cols-2 gap-3 mt-10">
        {options.map(o => (
          <button key={o} onClick={() => onSelect(o)} className="bg-ivory p-5 hover:bg-madder hover:text-ivory transition-colors font-display text-lg text-kohl border border-mitti/20">
            {o}
          </button>
        ))}
      </div>
    </>
  );
}
