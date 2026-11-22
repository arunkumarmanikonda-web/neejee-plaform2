'use client';
import Link from 'next/link';
import { Bookmark, ShoppingBag, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatINR } from '@/lib/money';
import { studies, type Study } from '@/lib/shop-studies';
import { defaultStyling, lookUrl, selectedAccessories } from '@/lib/stylebook';
import { useRouter } from 'next/navigation';
import { changeSample, useSampleBag } from '@/lib/sample-bag';
import { TileGallery, type PieceView } from '@/components/product/TileGallery';
import { studyTextiles } from '@/lib/study-textiles';
import { findSareeTerms, normalizeSareeText, sareeVocabulary } from '@/lib/saree-vocabulary';
import { TextileGuide } from './TextileGuide';
import './shop.css';
import '@/components/product/merchandise.css';

const savedKey = 'neejee.shop-studies.saved.v1';
function restore<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}
function persist(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function studyViews(s:Study):PieceView[] {
  return [{src:s.image,label:'Worn'}, {src:'/brand/study-views/'+s.id+'.webp', label:s.group==='sarees'?'Laid out':'The set'},
    {src:s.image,label:s.group==='sarees'?'Border crop':'Detail crop',zoom:2.7,focus:s.focus}];
}
export function StudyShelf({ids, preview, email, home = false}: {ids: string[]; preview: boolean; email: string; home?: boolean}) {
  const all = ids.map(id => studies.find(s => s.id === id)).filter((s): s is Study => !!s);
  const [shade, setShade] = useState('');
  const [query,setQuery]=useState('');
  const [saved, setSaved] = useState<string[]>([]);
  const [onlySaved, setOnlySaved] = useState(false);
  const [sort, setSort] = useState('featured');
  const router = useRouter();
  const bag = useSampleBag();
  const [picked, setPicked] = useState<Study>(all[0]);
  const [pieceView,setPieceView]=useState(0);
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
  const terms=findSareeTerms(query);
  const shown = all.filter(s => {
    const t=studyTextiles[s.id];
    const text=normalizeSareeText([s.name,s.shade,t?.region,...(t?.searchNames||[])].join(' '));
    return (!shade || s.shade===shade) && (!onlySaved || saved.includes(s.id)) &&
      (!query.trim() || text.includes(normalizeSareeText(query)) || terms.some(term=>t?.traditionIds.includes(term.id)));
  });
  const hasSarees=all.some(s=>s.group==='sarees');
  const textile=studyTextiles[picked?.id];
  const opened=picked ? studyViews(picked)[pieceView] : null;
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
  function openPiece(s: Study, view = 0) {
    setPicked(s); setPieceView(view); dialog.current?.showModal();
  }
  function buy(s:Study,destination: string) {
    changeSample(s.id, 1);
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
        <button aria-pressed={shade === '' && !onlySaved} onClick={() => {setShade('');setOnlySaved(false);setQuery('');}}>All</button>
        {colours.map(([name,hex]) => <button key={name} aria-pressed={shade === name} onClick={() => {setShade(shade === name ? '' : name);setOnlySaved(false);}}><i style={{background:hex}}/>{name}</button>)}
        <button aria-pressed={onlySaved} onClick={() => {setOnlySaved(!onlySaved);setShade('');}}><Bookmark size={13}/>Saved</button>
      </div>
      {hasSarees && <label className="nj-textile-search">Textile or region<input type="search" list="nj-traditions" value={query} onChange={e=>setQuery(e.target.value)} placeholder="e.g. Bandhani or Gujarat"/><datalist id="nj-traditions">{sareeVocabulary.map(t=><option key={t.id} value={t.name}/>)}</datalist></label>}
      <label className="nj-sort">Sort <select aria-label="Sort collection" value={sort} onChange={e => setSort(e.target.value)}><option value="featured">Featured</option>{preview && <><option value="low">Price: low to high</option><option value="high">Price: high to low</option></>}<option value="name">Name: A to Z</option></select></label>
    </div>}
    <div className="nj-grid" aria-live="polite">
      {shown.map((s, index) => <article key={s.id} className="nj-tile">
        <TileGallery name={s.name} eager={index<4} views={studyViews(s)} onOpen={i=>openPiece(s,i)}>
          <button className="nj-save" aria-label={(saved.includes(s.id) ? 'Unsave ' : 'Save ')+s.name} aria-pressed={saved.includes(s.id)} onClick={()=>save(s.id)}><Bookmark size={17} fill={saved.includes(s.id)?'currentColor':'none'}/></button>
        </TileGallery>
        <div className="nj-card-text nj-study-ticket">
          <div className="nj-piece-colour"><i style={{background:s.swatch}}/>{s.shade} <span>· {s.group==='sarees'?'Design study':'Suit set'}</span></div>
          <h3><button onClick={()=>openPiece(s)}>{s.name}</button></h3>
          <p className="nj-place-note">{studyTextiles[s.id] ? 'Inspired by '+studyTextiles[s.id].region : s.detail}</p>
          {preview && <strong className="nj-card-price">{formatINR(s.price)}</strong>}
          <div className="nj-tile-actions">{preview ? <button type="button" className="nj-add-tile" aria-label={'Add '+s.name+' to bag'} onClick={()=>buy(s,'/cart?bag=sample')}><ShoppingBag size={15}/> Add to bag</button> :
            <a className="nj-add-tile" href={'mailto:'+email+'?subject='+encodeURIComponent('Enquiry about '+s.name)}>Enquire</a>}
            <button className="nj-piece-link" onClick={()=>openPiece(s)}>View piece</button></div>
        </div>
      </article>)}
    </div>
    {!shown.length && <p className="nj-no-results">No pieces match this selection. <button onClick={()=>{setOnlySaved(false);setShade('');setQuery('');}}>Clear filters</button></p>}
    {!home && hasSarees && <TextileGuide/>}
    {home && <Link className="nj-more" href="/edits/sarees">Shop the saree collection <span aria-hidden="true">→</span></Link>}
    <dialog ref={dialog} className="nj-dialog" aria-labelledby="nj-modal-title" onClick={e => {if(e.target === dialog.current) dialog.current.close();}}>
      <div className="nj-modal-content"><button className="nj-modal-close" aria-label="Close" autoFocus onClick={() => dialog.current?.close()}><X size={21}/></button>
      {picked && <div className="nj-piece">
        <div className="nj-piece-photo nj-piece-gallery">{opened&&<img src={opened.src} alt={picked.name+' · '+opened.label} style={{objectPosition:opened.focus,transformOrigin:opened.focus,transform:opened.zoom?'scale('+opened.zoom+')':undefined}}/>}
          <div className="nj-piece-views" role="group" aria-label="Product photographs">{studyViews(picked).map((v,i)=><button key={v.label} aria-pressed={i===pieceView} onClick={()=>setPieceView(i)}>{v.label}</button>)}</div></div>
        <div className="nj-piece-copy"><p className="nj-overline"><i style={{background:picked.swatch}}/>{picked.shade} · {textile?'Design study':'Suit set'}</p>
          <h2 id="nj-modal-title">{picked.name}</h2><p>{picked.detail}</p>
          {textile&&<dl className="nj-fabric-notes">{[['Design reference',textile.region],['Border',textile.border],['Pallu',textile.pallu]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
          <div className="nj-buy">{preview ? <><strong>{formatINR(picked.price)}</strong><small>Sample piece · No payment will be taken</small>
            <div className="nj-buy-actions"><button className="nj-primary" onClick={() => buy(picked,'/checkout/sample')}>Buy now</button><button className="nj-secondary" onClick={() => buy(picked,'/cart?bag=sample')}><ShoppingBag size={16}/> Add to bag</button></div>
          </> : <><small>Styling study · Enquiries welcome</small><a className="nj-primary" href={'mailto:'+email+'?subject='+encodeURIComponent('Enquiry about '+picked.name)}>Ask about this piece</a></>}</div>
          <details className="nj-optional"><summary>Styling ideas</summary><p>{picked.pairing}</p>
          {picked.group === 'sarees' && <><div className="nj-pairing">{selectedAccessories(defaultStyling(picked.id)).map(a => <figure key={a.id}><img src={a.image} alt=""/><figcaption>{a.name}</figcaption></figure>)}</div><Link className="nj-text-link" href={lookUrl('/looks', defaultStyling(picked.id))}>See more ways to wear it</Link></>}</details>
        </div></div>}
      </div>
    </dialog>
  </section>;
}
