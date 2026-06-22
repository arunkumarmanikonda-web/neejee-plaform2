'use client';
import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import type { Product } from '@/lib/data';

export function ProductAccordion({ product }: { product: Product }) {
  const [open, setOpen] = useState<string | null>('craft');

  const sections = [
    {
      id: 'craft', title: 'CRAFT STORY',
      body: product.story || product.description,
    },
    {
      id: 'artisan', title: 'ARTISAN PROFILE',
      body: (
        <>
          <p className="font-display italic text-xl text-kohl">{product.artisanName}</p>
          <p className="label text-mitti mt-2">{product.region.toUpperCase()}{product.state ? ` · ${product.state.toUpperCase()}` : ''}</p>
          <p className="font-body text-kohl/85 mt-3">
            {product.artisanBio || `Master of ${product.craft.toLowerCase()}. Each piece is made by hand — slowly, attentively, and with the kind of skill that takes a lifetime to accumulate.`}
          </p>
          <p className="label text-madder mt-4">FAIR-TRADE · PAID IN ADVANCE</p>
        </>
      ),
    },
    {
      id: 'care', title: 'CARE & STORAGE',
      body: product.careInstructions || 'Treat this piece as you would an heirloom. Dry-clean only, store wrapped in muslin or cotton, refold every 3 months. Keep away from direct sunlight and moisture.',
    },
    {
      id: 'delivery', title: 'SHIPPING & RETURNS',
      body: (
        <ul className="space-y-2">
          <li>· Free shipping above ₹2,500 (pan-India)</li>
          <li>· Hand-delivered in NEEJEE Sandook · authenticity card included</li>
          <li>· 7-day easy return on unworn pieces</li>
          <li>· International: USA, UK, UAE, Singapore (calculated at checkout)</li>
        </ul>
      ),
    },
    ...(product.sustainabilityNote ? [{
      id: 'sustain', title: 'SUSTAINABILITY',
      body: product.sustainabilityNote,
    }] : []),
  ];

  return (
    <div className="mt-10 border-t border-mitti/15">
      {sections.map(s => (
        <div key={s.id} className="border-b border-mitti/15">
          <button
            onClick={() => setOpen(open === s.id ? null : s.id)}
            className="w-full flex justify-between items-center py-5 text-left"
          >
            <span className="font-ui text-xs tracking-widest text-kohl">{s.title}</span>
            {open === s.id ? <Minus className="w-4 h-4 text-madder" /> : <Plus className="w-4 h-4 text-mitti" />}
          </button>
          {open === s.id && (
            <div className="pb-6 font-body text-kohl/85 leading-relaxed">
              {typeof s.body === 'string' ? <p>{s.body}</p> : s.body}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
