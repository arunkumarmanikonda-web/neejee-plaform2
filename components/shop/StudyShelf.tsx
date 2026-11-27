'use client';
import Link from 'next/link';
import { Bookmark, ChevronDown, Plus, ShoppingBag, X } from 'lucide-react';
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
import { usePhotoRail } from '@/components/gallery/usePhotoRail';
import './shop.css';
import styles from './PieceTicket.module.css';
import '@/components/product/merchandise.css';

const savedKey = 'neejee.shop-studies.saved.v1';
function restore<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}
function persist(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function studyViews(s:Study):PieceView[] {
  return [{src:s.image,label:'Worn'}, {src:'/brand/study-views/'+s.id+'.webp', label:s.group==='sarees'?'Cloth detail':'The set'},
    {src:s.image,label:s.group==='sarees'?'Border detail':'Detail',zoom:2.7,focus:s.focus}];
}
function PiecePhotographs({ piece, initial }: { piece: Study; initial: number }) {
  const views = studyViews(piece);
  const rail = usePhotoRail(views.length, initial);
  return <div className="nj-piece-photo nj-piece-gallery" role="group" aria-label={'Photographs of '+piece.name} onKeyDown={rail.onKeyDown}>
    <div className="photo-rail nj-detail-rail" {...rail.props}>
      {views.map((view,i)=><div data-slide="" key={view.label} aria-hidden={rail.active!==i}>
        <img src={view.src} alt={piece.name+' · '+view.label} draggable={false}
          style={{objectPosition:view.focus,transformOrigin:view.focus,transform:view.zoom?'scale('+view.zoom+')':undefined}}/>
      </div>)}
    </div>
    <div className="nj-piece-views" role="group" aria-label="Product photographs">
      {views.map((v,i)=><button key={v.label} aria-pressed={i===rail.active} onClick={()=>rail.go(i)}>{v.label}</button>)}
    </div>
  </div>;
}
export function StudyShelf({ids, preview, email, initialPiece, home = false}: {ids: string[]; preview: boolean; email: string; initialPiece?:string; home?: boolean}) {
  const all = ids.map(id => studies.find(s => s.id === id)).filter((s): s is Study => !!s);
  const [shade, setShade] = useState('');
  const [showFabric, setShowFabric] = useState(false);
  const [query,setQuery]=useState('');
  const [saved, setSaved] = useState<string[]>([]);
  const [onlySaved, setOnlySaved] = useState(false);
  const [sort, setSort] = useState('featured');
  const router = useRouter();
  const bag = useSampleBag();
  const [picked, setPicked] = useState<Study>(all[0]);
  const [photoSession,setPhotoSession]=useState({ initial:0, version:0 });
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
  useEffect(() => {
    const piece = studies.find(s => s.id === initialPiece && ids.includes(s.id));
    if (piece && dialog.current && !dialog.current.open) {
      setPicked(piece); setPhotoSession(previous=>({initial:0,version:previous.version+1}));
      dialog.current.showModal();
    }
  }, [initialPiece, ids]);
  const terms=findSareeTerms(query);
  const shown = all.filter(s => {
    const t=studyTextiles[s.id];
    const text=normalizeSareeText([s.alias,s.name,s.caption,s.shade,t?.region,...(t?.searchNames||[])].join(' '));
    return (!shade || s.shade===shade) && (!onlySaved || saved.includes(s.id)) &&
      (!query.trim() || text.includes(normalizeSareeText(query)) || terms.some(term=>t?.traditionIds.includes(term.id)));
  });
  const hasSarees=all.some(s=>s.group==='sarees');
  const textile=studyTextiles[picked?.id];
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
    setPicked(s); setPhotoSession(previous=>({initial:view,version:previous.version+1})); dialog.current?.showModal();
  }
  function buy(s:Study,destination: string) {
    changeSample(s.id, 1);
    dialog.current?.close();
    router.push(destination);
  }
  return <section className="nj-shelf" aria-label={preview ? 'Preview collection' : 'Collection studies'}>
    <div className="nj-shelf-head"><div><h2>{home ? <>Sarees <em>&amp; suit sets</em></> : 'The collection'}</h2>
      <p>{preview ? 'Collection preview · Sample prices' : 'Style the collection · Not yet on sale'}</p></div>
      {home ? <Link className="nj-bag-link" href="/edits/clothing">Shop the collection</Link> : preview && <Link className="nj-bag-link" href="/cart?bag=sample"><ShoppingBag size={16}/> View bag ({count})</Link>}
    </div>
    <div className="loom-tools">
      <div className="loom-presentation" role="group" aria-label="Collection photographs">
        <button type="button" aria-pressed={!showFabric} onClick={()=>setShowFabric(false)}>On the model</button>
        <button type="button" aria-pressed={showFabric} onClick={()=>setShowFabric(true)}>Fabric close-up</button>
      </div>
      {!home && <><details className="loom-filter">
        <summary>Filters{(shade || query || onlySaved) ? ' · Active' : ''}<ChevronDown size={15}/></summary>
        <div className="loom-filter-panel">
          <div className="nj-filters" role="group" aria-label="Filter by colour">
            <button aria-pressed={!shade && !onlySaved} onClick={()=>{setShade('');setOnlySaved(false);setQuery('');}}>All colours</button>
            {colours.map(([name,hex])=><button key={name} aria-pressed={shade === name} onClick={()=>{setShade(shade===name?'':name);setOnlySaved(false);}}><i style={{background:hex}}/>{name}</button>)}
            <button aria-pressed={onlySaved} onClick={()=>{setOnlySaved(!onlySaved);setShade('');}}><Bookmark size={14}/> Saved</button>
          </div>
          {hasSarees && <label className="nj-textile-search">Textile or region<input type="search" list="nj-traditions" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Bandhani, Gujarat…"/><datalist id="nj-traditions">{sareeVocabulary.map(t=><option key={t.id} value={t.name}/>)}</datalist></label>}
        </div>
      </details>
      <label className="loom-sort">Sort <select aria-label="Sort collection" value={sort} onChange={e=>setSort(e.target.value)}><option value="featured">Featured</option>{preview && <><option value="low">Price, low to high</option><option value="high">Price, high to low</option></>}<option value="name">Name, A to Z</option></select></label></>}
    </div>
    <div className="nj-grid" aria-live="polite">
      {shown.map((s, index) => <article key={s.id} className="nj-tile loom-card">
        <TileGallery detailView={{index:1,label:s.group==='sarees'?'See fabric':'See the set'}} initialView={showFabric ? 1 : 0} name={s.name} eager={!home && index<4} views={studyViews(s)} onOpen={i=>openPiece(s,i)}>
          <button className="nj-save" aria-label={(saved.includes(s.id) ? 'Unsave ' : 'Save ')+s.name} aria-pressed={saved.includes(s.id)} onClick={()=>save(s.id)}><Bookmark size={17} fill={saved.includes(s.id)?'currentColor':'none'}/></button>
        </TileGallery>
        <div className="loom-ticket">
          <div className={styles.label}>
            <span><i aria-hidden="true" style={{background:s.swatch}}/>{s.alias}</span>
            {preview && <strong>{formatINR(s.price)}</strong>}
          </div>
          <h3 className={styles.name}><button onClick={()=>openPiece(s)}>{s.name}</button></h3>
          <p className={styles.caption}>{s.caption}</p>
          <div className="loom-actions">
            {preview ? <button type="button" className="loom-add" aria-label={'Add '+s.name+' to bag'} onClick={()=>buy(s,'/cart?bag=sample')}><Plus size={15}/> Add to bag</button> :
              <Link className="loom-add" href={'/style?study='+s.id}>Style this piece</Link>}
            <button type="button" className="loom-detail" onClick={()=>openPiece(s)}>Details</button>
            {preview && s.group==='sarees' && <Link className="loom-style-link" href={lookUrl('/ai/mirror',defaultStyling(s.id))}>Style in Aaina</Link>}
          </div>
        </div>
      </article>)}
    </div>
    {!shown.length && <p className="nj-no-results">No pieces match this selection. <button onClick={()=>{setOnlySaved(false);setShade('');setQuery('');}}>Clear filters</button></p>}
    {!home && hasSarees && <TextileGuide/>}
    <dialog ref={dialog} className="nj-dialog loom-dialog" aria-labelledby="nj-modal-title" onClick={e => {if(e.target === dialog.current) dialog.current.close();}}>
      <div className="nj-modal-content"><button className="nj-modal-close" aria-label="Close" autoFocus onClick={() => dialog.current?.close()}><X size={21}/></button>
      {picked && photoSession.version>0 && <div className="nj-piece loom-piece">
        <PiecePhotographs key={photoSession.version} piece={picked} initial={photoSession.initial}/>
        <div className="nj-piece-copy"><p className="loom-spec"><i aria-hidden="true" style={{background:picked.swatch}}/>{picked.alias}</p>
          <h2 id="nj-modal-title">{picked.name}</h2><p>{picked.detail}</p>

          <div className="nj-buy">{preview ? <><strong>{formatINR(picked.price)}</strong><small>Preview price · Sample checkout</small>
            <div className="nj-buy-actions"><button className="nj-primary" onClick={() => buy(picked,'/checkout/sample')}>Buy now</button><button className="nj-secondary" onClick={() => buy(picked,'/cart?bag=sample')}><ShoppingBag size={16}/> Add to bag</button></div>
          </> : <><small>Not yet on sale</small><Link className="nj-primary" href={'/style?study='+picked.id}>Style this piece in Aaina</Link></>}</div>
          {textile && <details className="loom-facts"><summary>Pattern &amp; textile details</summary>
            <p>{textile.reference}</p><dl className="nj-fabric-notes">{[['Border',textile.border],['Pallu',textile.pallu]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            <small>Regional references describe the pattern on this preview piece.</small></details>}
          <details className="nj-optional"><summary>Styling ideas</summary><p>{picked.pairing}</p>
          {picked.group === 'sarees' && <><div className="nj-pairing">{selectedAccessories(defaultStyling(picked.id)).map(a => <figure key={a.id}><img src={a.image} alt=""/><figcaption>{a.name}</figcaption></figure>)}</div><Link className="nj-text-link" href={lookUrl('/looks', defaultStyling(picked.id))}>See more ways to wear it</Link></>}</details>
        </div></div>}
      </div>
    </dialog>
  </section>;
}
