'use client';
import Link from 'next/link';
import { Bookmark, Scan, ShoppingBag, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatINR } from '@/lib/money';
import { studies, type Study } from '@/lib/shop-studies';
import { defaultStyling, lookUrl, selectedAccessories } from '@/lib/stylebook';
import { useRouter } from 'next/navigation';
import { changeSample, useSampleBag } from '@/lib/sample-bag';
import './shop.css';

const savedKey = 'neejee.shop-studies.saved.v1';
function restore<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}
function persist(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
export function StudyShelf({ids, preview, email, home = false}: {ids: string[]; preview: boolean; email: string; home?: boolean}) {
  const all = ids.map(id => studies.find(s => s.id === id)).filter((s): s is Study => !!s);
  const [shade, setShade] = useState('');
  const [saved, setSaved] = useState<string[]>([]);
  const [onlySaved, setOnlySaved] = useState(false);
  const [sort, setSort] = useState('featured');
  const router = useRouter();
  const bag = useSampleBag();
  const [picked, setPicked] = useState<Study>(all[0]);
  const [detail, setDetail] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const sync = () => {
      const ids = restore<unknown>(savedKey, []);
      setSaved(Array.isArray(ids) ? ids.filter(i => typeof i === 'string') : []);
    };
    sync();
    if (preview && new URLSearchParams(window.location.search).get('bag') === 'open') router.replace('/cart?bag=sample');
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [preview, router]);
  const shown = all.filter(s => (!shade || s.shade === shade) && (!onlySaved || saved.includes(s.id)));
  if (sort === 'low') shown.sort((a,b) => a.price - b.price);
  if (sort === 'high') shown.sort((a,b) => b.price - a.price);
  if (sort === 'name') shown.sort((a,b) => a.name.localeCompare(b.name));
  const colours = [...new Map(all.map(s => [s.shade, s.swatch])).entries()];
  const bagItems = studies.filter(s => bag[s.id] > 0);
  const count = bagItems.reduce((n,s) => n + bag[s.id], 0);
  function save(id: string) {
    const next = saved.includes(id) ? saved.filter(x => x !== id) : [...saved,id];
    setSaved(next); persist(savedKey,next);
  }
  function openPiece(s: Study, closeUp = false) {
    setPicked(s); setDetail(closeUp); dialog.current?.showModal();
  }
  function buy(destination: string) {
    changeSample(picked.id, 1);
    dialog.current?.close();
    router.push(destination);
  }
  return <section className="nj-shelf" aria-label={preview ? 'Preview collection' : 'Collection studies'}>
    <div className="nj-shelf-head"><div><h2>{home ? 'On the counter' : 'Browse the collection'}</h2>
      <p>{preview ? 'Preview collection · Sample prices' : 'Styling studies · Enquire about a design'}</p></div>
      {preview && <Link className="nj-bag-link" href="/cart?bag=sample"><ShoppingBag size={16}/> View bag ({count})</Link>}
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
      {picked && <div className="nj-piece">
        <div className={'nj-piece-photo'+(detail?' nj-zoom':'')}><img src={picked.image} alt={detail ? 'Enlarged detail of '+picked.name : 'Full outfit, '+picked.name} style={{objectPosition:picked.focus,transformOrigin:picked.focus}}/><button aria-pressed={detail} onClick={() => setDetail(!detail)}><Scan size={15}/>{detail ? 'Show full look' : 'Look closer'}</button></div>
        <div className="nj-piece-copy"><p className="nj-overline"><i style={{background:picked.swatch}}/>{picked.shade} · {picked.group === 'sarees'?'Saree':'Suit set'}</p>
          <h2 id="nj-modal-title">{picked.name}</h2><p>{picked.detail}</p>
          <div className="nj-buy">{preview ? <><strong>{formatINR(picked.price)}</strong><small>Sample piece · No payment will be taken</small>
            <div className="nj-buy-actions"><button className="nj-primary" onClick={() => buy('/checkout/sample')}>Buy now</button><button className="nj-secondary" onClick={() => buy('/cart?bag=sample')}><ShoppingBag size={16}/> Add to bag</button></div>
          </> : <><small>Styling study · Enquiries welcome</small><a className="nj-primary" href={'mailto:'+email+'?subject='+encodeURIComponent('Enquiry about '+picked.name)}>Ask about this piece</a></>}</div>
          <details className="nj-optional"><summary>Styling ideas</summary><p>{picked.pairing}</p>
          {picked.group === 'sarees' && <><div className="nj-pairing">{selectedAccessories(defaultStyling(picked.id)).map(a => <figure key={a.id}><img src={a.image} alt=""/><figcaption>{a.name}</figcaption></figure>)}</div><Link className="nj-text-link" href={lookUrl('/looks', defaultStyling(picked.id))}>See more ways to wear it</Link></>}</details>
        </div></div>}
      </div>
    </dialog>
  </section>;
}
