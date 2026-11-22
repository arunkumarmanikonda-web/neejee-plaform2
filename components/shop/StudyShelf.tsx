'use client';
import Link from 'next/link';
import { Bookmark, Check, Minus, Plus, Scan, ShoppingBag, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatINR } from '@/lib/money';
import { studies, type Study } from '@/lib/shop-studies';
import { defaultStyling, lookUrl, selectedAccessories } from '@/lib/stylebook';
import './shop.css';

type Bag = Record<string, number>;
const bagKey = 'neejee.shop-preview.bag.v1';
const savedKey = 'neejee.shop-studies.saved.v1';
function restore<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}
function persist(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function readBag(): Bag {
  const data = restore<Bag>(bagKey, {});
  return Object.fromEntries(studies.flatMap(s => Number.isInteger(data?.[s.id]) && data[s.id] > 0 ? [[s.id, Math.min(9, data[s.id])]] : []));
}
export function StudyShelf({ids, preview, email, home = false}: {ids: string[]; preview: boolean; email: string; home?: boolean}) {
  const all = ids.map(id => studies.find(s => s.id === id)).filter((s): s is Study => !!s);
  const [shade, setShade] = useState('');
  const [saved, setSaved] = useState<string[]>([]);
  const [onlySaved, setOnlySaved] = useState(false);
  const [sort, setSort] = useState('featured');
  const [bag, setBag] = useState<Bag>({});
  const [screen, setScreen] = useState<'piece'|'bag'|'done'>('piece');
  const [picked, setPicked] = useState<Study>(all[0]);
  const [detail, setDetail] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const sync = () => {
      const ids = restore<unknown>(savedKey, []);
      setSaved(Array.isArray(ids) ? ids.filter(i => typeof i === 'string') : []);
      if (preview) setBag(readBag());
    };
    sync();
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [preview]);
  const shown = all.filter(s => (!shade || s.shade === shade) && (!onlySaved || saved.includes(s.id)));
  if (sort === 'low') shown.sort((a,b) => a.price - b.price);
  if (sort === 'high') shown.sort((a,b) => b.price - a.price);
  if (sort === 'name') shown.sort((a,b) => a.name.localeCompare(b.name));
  const colours = [...new Map(all.map(s => [s.shade, s.swatch])).entries()];
  const bagItems = studies.filter(s => bag[s.id] > 0);
  const count = bagItems.reduce((n,s) => n + bag[s.id], 0);
  const total = bagItems.reduce((n,s) => n + bag[s.id]*s.price, 0);
  function save(id: string) {
    const next = saved.includes(id) ? saved.filter(x => x !== id) : [...saved,id];
    setSaved(next); persist(savedKey,next);
  }
  function adjust(id: string, delta: number) {
    const latest = readBag();
    const n = Math.max(0, Math.min(9, (latest[id] || 0) + delta));
    if (n) latest[id] = n; else delete latest[id];
    setBag(latest); persist(bagKey,latest);
  }
  function openPiece(s: Study, closeUp = false) {
    setPicked(s); setDetail(closeUp); setScreen('piece'); dialog.current?.showModal();
  }
  function openBag() { setScreen('bag'); if (!dialog.current?.open) dialog.current?.showModal(); }
  return <section className="nj-shelf" aria-label={preview ? 'Preview collection' : 'Collection studies'}>
    <div className="nj-shelf-head"><div><h2>{home ? 'On the counter' : 'Browse the collection'}</h2>
      <p>{preview ? 'Preview collection · Sample prices' : 'Styling studies · Enquire about a design'}</p></div>
      {preview && <button className="nj-bag-link" onClick={openBag}><ShoppingBag size={16}/> Preview bag ({count})</button>}
    </div>
    {!home && <div className="nj-tools">
      <div className="nj-filters" role="group" aria-label="Filter by colour">
        <button aria-pressed={shade === '' && !onlySaved} onClick={() => {setShade('');setOnlySaved(false);}}>All</button>
        {colours.map(([name,hex]) => <button key={name} aria-pressed={shade === name} onClick={() => {setShade(shade === name ? '' : name);setOnlySaved(false);}}><i style={{background:hex}}/>{name}</button>)}
        <button aria-pressed={onlySaved} onClick={() => {setOnlySaved(!onlySaved);setShade('');}}><Bookmark size={13}/>Saved</button>
      </div>
      <label className="nj-sort">Sort <select aria-label="Sort collection" value={sort} onChange={e => setSort(e.target.value)}><option value="featured">Featured</option>{preview && <><option value="low">Price: low to high</option><option value="high">Price: high to low</option></>}<option value="name">Name: A to Z</option></select></label>
    </div>}
    <div className="nj-grid" aria-live="polite">
      {shown.map((s, index) => <article key={s.id} className="nj-tile">
        <div className="nj-ticket"><h3><button onClick={() => openPiece(s)}>{s.name}</button></h3>{preview ? <strong>{formatINR(s.price)}</strong> : <small>Style study</small>}</div>
        <div className="nj-photo">
          <button className="nj-image-open" aria-label={'View '+s.name} onClick={() => openPiece(s)}><img src={s.image} alt={s.name + ' worn full length. ' + s.detail} loading={index < 4 ? 'eager' : 'lazy'} width="588" height="882"/></button>
          <button className="nj-save" aria-label={(saved.includes(s.id) ? 'Unsave ' : 'Save ')+s.name} aria-pressed={saved.includes(s.id)} onClick={() => save(s.id)}><Bookmark size={17} fill={saved.includes(s.id)?'currentColor':'none'}/></button>
          <button className="nj-detail-btn" onClick={() => openPiece(s, true)} aria-label={'See '+s.name+' close up'}><span className="nj-cloth-chip" aria-hidden="true" style={{backgroundImage:'url('+s.image+')',backgroundPosition:s.focus}}/>{s.group === 'sarees' ? 'Border detail' : 'See detail'}</button>
        </div>
        <div className="nj-card-text nj-card-foot"><div className="nj-overline"><i style={{background:s.swatch}}/>{s.shade} · {s.group === 'sarees' ? 'Saree' : 'Suit set'}</div>
        <div className="nj-card-bottom"><button onClick={() => openPiece(s)}>View piece <span aria-hidden="true">↗</span></button></div></div>
      </article>)}
    </div>
    {!shown.length && <p className="nj-no-results">Save a piece using the bookmark on its photograph. <button onClick={() => {setOnlySaved(false);setShade('');}}>See all pieces</button></p>}
    {home && <Link className="nj-more" href="/edits/sarees">Shop the saree collection <span aria-hidden="true">→</span></Link>}
    <dialog ref={dialog} className="nj-dialog" aria-labelledby="nj-modal-title" onClick={e => {if(e.target === dialog.current) dialog.current.close();}}>
      <div className="nj-modal-content"><button className="nj-modal-close" aria-label="Close" autoFocus onClick={() => dialog.current?.close()}><X size={21}/></button>
      {screen === 'piece' && picked && <div className="nj-piece">
        <div className={'nj-piece-photo'+(detail?' nj-zoom':'')}><img src={picked.image} alt={detail ? 'Enlarged detail of '+picked.name : 'Full outfit, '+picked.name} style={{objectPosition:picked.focus,transformOrigin:picked.focus}}/><button aria-pressed={detail} onClick={() => setDetail(!detail)}><Scan size={15}/>{detail ? 'Show full look' : 'Look closer'}</button></div>
        <div className="nj-piece-copy"><p className="nj-overline"><i style={{background:picked.swatch}}/>{picked.shade} · {picked.group === 'sarees'?'Saree':'Suit set'}</p>
          <h2 id="nj-modal-title">{picked.name}</h2><p>{picked.detail}</p>
          <h3>Wear it with</h3><p>{picked.pairing}</p>
          {picked.group === 'sarees' && <><div className="nj-pairing">{selectedAccessories(defaultStyling(picked.id)).map(a => <figure key={a.id}><img src={a.image} alt=""/><figcaption>{a.name}</figcaption></figure>)}</div><Link className="nj-text-link" href={lookUrl('/looks', defaultStyling(picked.id))}>Change juttis & jewellery ↗</Link></>}
          <div className="nj-buy">{preview ? <><strong>{formatINR(picked.price)}</strong><small>Sample price · AI styling study</small><button className="nj-primary" onClick={() => {adjust(picked.id,1);openBag();}}>Add to preview bag <ShoppingBag size={16}/></button></> : <><small>AI styling study · Enquiries welcome</small><a className="nj-primary" href={'mailto:'+email+'?subject='+encodeURIComponent('Enquiry about '+picked.name)}>Ask about this style ↗</a></>}</div>
        </div></div>}
      {screen === 'bag' && <div className="nj-bag"><p className="nj-overline">Storefront preview</p><h2 id="nj-modal-title">Your preview bag</h2><p>This bag lets you try the shop with sample prices.</p>
        {bagItems.map(s => <div className="nj-bag-row" key={s.id}><img src={s.image} alt=""/><div><b>{s.name}</b><small>{formatINR(s.price)} each</small><div className="nj-qty"><button aria-label={'Decrease '+s.name+' quantity'} onClick={() => adjust(s.id,-1)}><Minus size={13}/></button>{bag[s.id]}<button aria-label={'Increase '+s.name+' quantity'} disabled={bag[s.id]>=9} onClick={() => adjust(s.id,1)}><Plus size={13}/></button></div></div><strong>{formatINR(bag[s.id]*s.price)}</strong></div>)}
        {count ? <><div className="nj-total"><b>Sample total</b><b>{formatINR(total)}</b></div><button className="nj-primary" onClick={() => {persist(bagKey,{});setBag({});setScreen('done');}}>Finish preview <Check size={16}/></button><small>No payment is taken.</small></> : <p>Your preview bag is empty.</p>}
        <button className="nj-text-link" onClick={() => dialog.current?.close()}>Continue browsing</button>
      </div>}
      {screen === 'done' && <div className="nj-bag"><Check/><h2 id="nj-modal-title">Preview complete</h2><p>Your sample shopping journey is complete. No order was placed or payment taken.</p><button className="nj-primary" onClick={() => dialog.current?.close()}>Back to the collection</button></div>}
      </div>
    </dialog>
  </section>;
}
