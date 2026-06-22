'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, X } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

export function SearchBar({ onClose }: { onClose: () => void }) {
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
    <div className="fixed inset-0 bg-kohl/80 z-50 flex items-start justify-center pt-32" onClick={onClose}>
      <div className="bg-ivory w-full max-w-2xl mx-6 p-8 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-4 border-b border-mitti/20 pb-4">
          <Search className="w-5 h-5 text-mitti" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by craft, region, weaver..."
            className="flex-1 font-display text-2xl bg-transparent outline-none text-kohl placeholder-mitti/60"
          />
          <button onClick={onClose}><X className="w-5 h-5 text-mitti" /></button>
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
              <Link key={p.id} href={`/products/${p.slug}`} onClick={onClose} className="flex gap-4 p-3 hover:bg-beige transition-colors">
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
    </div>
  );
}
