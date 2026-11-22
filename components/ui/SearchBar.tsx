'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, X } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

export function SearchBar({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  function dismiss() {
    dialog.current?.close();
    onClose();
  }
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (query.length < 2) {
      fetch('/api/search?q=').then(r => r.json()).then(d => setSuggestions(d.suggestions || []));
      setResults([]); return;
    }
    const t = setTimeout(() => {
      fetch('/api/search?q=' + encodeURIComponent(query)).then(r => r.json()).then(d => setResults(d.results || []));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <dialog ref={dialog} aria-label="Search the shop" className="fixed inset-0 w-full h-full max-w-none max-h-none m-0 bg-transparent px-4 pt-24 sm:pt-32 backdrop:bg-kohl/80" onCancel={e=>{e.preventDefault();dismiss();}} onClick={e=>{if(e.target===e.currentTarget)dismiss();}}>
      <div className="bg-ivory w-full max-w-2xl mx-auto p-5 sm:p-8 max-h-[75dvh] overflow-y-auto">
        <div className="flex items-center gap-4 border-b border-mitti/20 pb-4">
          <Search className="w-5 h-5 text-mitti" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by craft, region, weaver..."
            aria-label="Search products by name, craft or region"
            className="min-w-0 flex-1 font-display text-2xl bg-transparent outline-none text-kohl placeholder-mitti/60"
          />
          <button type="button" onClick={dismiss} aria-label="Close search" className="grid min-h-11 min-w-11 place-items-center"><X className="w-5 h-5 text-mitti" /></button>
        </div>

        {query.length < 2 && (
          <div className="mt-6">
            <p className="label text-mitti">SUGGESTIONS</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {suggestions.map(s => (
                <button key={s} onClick={() => setQuery(s)} className="px-3 py-1.5 bg-beige hover:bg-mitti/20 font-ui text-xs tracking-widest">{s.toUpperCase()}</button>
              ))}
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="mt-6 space-y-3">
            <p className="label text-mitti">{results.length} FOUND</p>
            {results.map((p: any) => (
              <Link key={p.id} href={`/products/${p.slug}`} onClick={dismiss} className="flex gap-4 p-3 hover:bg-beige transition-colors">
                <div className="w-16 h-20 bg-beige relative flex-shrink-0">
                  {p.images[0] && <Image src={p.images[0]} alt="" fill className="object-cover" />}
                </div>
                <div className="flex-1">
                  <p className="font-display text-base text-kohl">{p.name}</p>
                  <p className="font-italic italic text-mitti text-xs mt-1">{p.craft} · {p.region}</p>
                  <p className="font-display text-sm text-kohl mt-1">{formatPrice(p.sellingPrice)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {query.length >= 2 && results.length === 0 && (
          <p className="font-italic italic text-mitti text-center mt-8">No results — but we are searching India for it.</p>
        )}
      </div>
    </dialog>
  );
}
