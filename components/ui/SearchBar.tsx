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
  type Match = {id:string; slug:string; name:string; images:string[]; craft?:string; region?:string; sellingPrice:number};
  type Enquiry = {id:string; name:string; shade:string; group:string; image:string};
  const [results, setResults] = useState<Match[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [state,setState] = useState<'idle'|'loading'|'ready'|'error'>('idle');
  const [attempt,setAttempt] = useState(0);
  const term = query.trim();
  function changeQuery(value:string) {
    setQuery(value); setResults([]); setEnquiries([]);
    setState(value.trim().length < 2 ? 'idle' : 'loading');
  }
  useEffect(() => {
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/search?q=' + encodeURIComponent(term), {signal:controller.signal});
        if (!res.ok) throw Error('Search unavailable');
        const data = await res.json();
        if (controller.signal.aborted) return;
        setResults(data.results || []); setEnquiries(data.enquiries || []); setState('ready');
      } catch {
        if (!controller.signal.aborted) setState('error');
      }
    }, 200);
    return () => {clearTimeout(timer); controller.abort();};
  }, [term,attempt]);

  return (
    <dialog ref={dialog} aria-label="Search the shop" className="fixed inset-0 w-full h-full max-w-none max-h-none m-0 bg-transparent px-4 pt-24 sm:pt-32 backdrop:bg-kohl/80" onCancel={e=>{e.preventDefault();dismiss();}} onClick={e=>{if(e.target===e.currentTarget)dismiss();}}>
      <div className="bg-ivory w-full max-w-2xl mx-auto p-5 sm:p-8 max-h-[75dvh] overflow-y-auto">
        <div className="flex items-center gap-4 border-b border-mitti/20 pb-4">
          <Search className="w-5 h-5 text-mitti" />
          <input
            autoFocus
            value={query}
            onChange={e => { if (e.target.value.trim() === term) setQuery(e.target.value); else changeQuery(e.target.value); }}
            placeholder="Try indigo, Bandhani or a lamp"
            aria-label="Search products by name, craft or region"
            className="min-w-0 flex-1 font-display text-2xl bg-transparent outline-none text-kohl placeholder-mitti/60"
          />
          <button type="button" onClick={dismiss} aria-label="Close search" className="grid min-h-11 min-w-11 place-items-center"><X className="w-5 h-5 text-mitti" /></button>
        </div>

        {term.length < 2 && (
          <div className="mt-6">
            <p className="label text-mitti">Explore the shop</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {['Sarees','Suit sets','Lamp'].map(s => (
                <button key={s} onClick={() => changeQuery(s)} className="min-h-11 px-3 py-1.5 bg-beige hover:bg-mitti/20 font-ui text-xs tracking-widest">{s.toUpperCase()}</button>
              ))}
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="mt-6 space-y-3">
            <p className="label text-mitti">Shop pieces · {results.length}</p>
            {results.map((p: Match) => (
              <Link key={p.id} href={`/products/${p.slug}`} onClick={dismiss} className="flex gap-4 p-3 hover:bg-beige transition-colors">
                <div className="w-16 h-20 bg-beige relative flex-shrink-0">
                  {p.images[0] && <Image src={p.images[0]} alt="" fill className="object-cover" />}
                </div>
                <div className="flex-1">
                  <p className="font-display text-base text-kohl">{p.name}</p>
                  <p className="font-italic italic text-mitti text-xs mt-1">{[p.craft,p.region].filter(Boolean).join(' · ')}</p>
                  <p className="font-display text-sm text-kohl mt-1">{formatPrice(p.sellingPrice)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!!enquiries.length && <section className="mt-6" aria-label="Collection previews">
          <h2 className="label text-mitti">Fashion to style</h2>
          {enquiries.map(piece=><Link key={piece.id} onClick={dismiss} href={'/edits/'+piece.group+'?piece='+piece.id} className="flex items-center gap-4 p-2 hover:bg-beige">
            <img src={piece.image} width="48" height="60" alt="" className="w-12 h-[60px] object-cover"/>
            <span className="font-display text-lg">{piece.name}</span>
          </Link>)}
        </section>}
        <div role="status" className="mt-4 font-ui text-sm text-mitti">
          {state==='loading' && 'Searching the shop…'}
          {state==='ready' && !results.length && !enquiries.length && 'No pieces found. Try a colour, craft or product name.'}
          {state==='error' && <>Search is temporarily unavailable. <button type="button" className="min-h-11 px-2" onClick={()=>{setState('loading');setAttempt(a=>a+1);}}>Try again</button></>}
        </div>
      </div>
    </dialog>
  );
}
