'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Bookmark, Check, Maximize2, Play, Sparkles, X } from 'lucide-react';
import { allAccessoriesPresent, defaultStyling, editorialLooks, editorialOptions, lookUrl, type StyleOption, type Styling } from '@/lib/stylebook';
import type { CounterCloth } from '@/lib/counter';
import styles from './Lookbook.module.css';

type Props = {initial:Styling;personalMirror:boolean; accessories?:StyleOption[]; items?:CounterCloth[]; product?:string; variant?:string; standalone?:boolean};
type View = 'full'|'detail'|'film';
const savedKey='neejee.saved-look.v1';

export function Lookbook({initial,personalMirror,items=[],accessories=[],product,variant,standalone=false}:Props) {
  const [choice,setChoice]=useState(initial);
  const defaults=defaultStyling(initial.look);
  const custom=useRef({shoe:initial.shoe!==defaults.shoe,jewel:initial.jewel!==defaults.jewel});
  const [selectedId,setSelectedId]=useState(()=>items.find(item=>variant?item.id==='v-'+variant:item.slug===product)?.id||((product||variant)?'missing':''));
  const [view,setView]=useState<View>('full');
  const [focus,setFocus]=useState(58);
  const [saved,setSaved]=useState('');
  const [restore,setRestore]=useState('');
  const [picking,setPicking]=useState<'shoe'|'jewel'>('shoe');
  const [lightbox,setLightbox]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);
  const tray=useRef<HTMLElement>(null);
  const look=editorialLooks.find(item=>item.id===choice.look)!;
  const garment=items.find(item=>item.id===selectedId);
  const stale=!!(product||variant) && !garment && selectedId==='missing';
  const image=garment?.image||look.image;
  const name=garment?.name||look.name;
  const suppliedFilm=garment?.video && (/^https?:\/\//.test(garment.video) || /^\/(?!\/)/.test(garment.video)) ? garment.video:undefined;
  const film=garment?suppliedFilm:(look.id==='sage'?'/brand/lookbook/sage-drape.mp4':undefined);
  const options=[...accessories,...editorialOptions];
  const shoe=options.find(item=>item.id===choice.shoe && item.slot==='shoe');
  const jewel=options.find(item=>item.id===choice.jewel && item.slot==='jewel');
  const allPresent=allAccessoriesPresent(choice,accessories);
  const address=lookUrl('/looks',choice,garment?.slug,garment?.id.slice(2));
  const mirror=lookUrl('/ai/mirror',choice,garment?.slug,garment?.id.slice(2));
  useEffect(()=>{
    try {const prior=localStorage.getItem(savedKey);if(prior?.startsWith('/looks?'))setRestore(prior);}catch{}
  },[]);
  useEffect(()=>{if(lightbox)dialog.current?.showModal();else dialog.current?.close();},[lightbox]);
  function changeLook(id:string) {
    const next=defaultStyling(id);
    setChoice(current=>({...next,shoe:custom.current.shoe?current.shoe:next.shoe,jewel:custom.current.jewel?current.jewel:next.jewel}));
    setSelectedId('');setView('full');setFocus(58);setSaved('');
  }
  function changeAccessory(id:string) {
    custom.current[picking]=true;
    setChoice(current=>({...current,[picking]:id}));setSaved('');
  }
  function useSuggestedPair() {
    custom.current={shoe:false,jewel:false};
    setChoice(defaultStyling(choice.look));setSaved('');
  }
  function seeTray(slot?:'shoe'|'jewel') {
    if(slot)setPicking(slot);
    tray.current?.scrollIntoView({behavior:'instant',block:'start'});
    tray.current?.focus({preventScroll:true});
  }
  function save() {
    try {localStorage.setItem(savedKey,address);setRestore(address);setSaved('Look saved on this device.');}
    catch {setSaved('Open the link below to bookmark your look.');}
  }
  function switchView(next:View){setView(next);setFocus(58);}
  if(stale) return <section className={styles.tray}><h1 className={styles.missingTitle}>This piece has left the styling tray.</h1><p>It may have sold. Your saved link still identifies the original piece.</p><Link className={styles.savedLink} href="/looks">Open the current lookbook</Link></section>;
  return <section className={styles.book} aria-label="The Neejee lookbook">
    <div className={styles.spread}>
      <div className={styles.photoColumn}>
        <div className={styles.photoNav} aria-label="Lookbook colours">{editorialLooks.map(item=><button key={item.id} onClick={()=>changeLook(item.id)} aria-pressed={!garment&&choice.look===item.id}><i style={{background:item.colour}}/>{item.shade}</button>)}</div>
        <div className={styles.photoStage}>
          {view==='film' && film ? /youtu\.be|youtube\.com|vimeo\.com/i.test(film) ? <a className={styles.primary} href={film}>Watch the original film</a> : <video key={film} controls autoPlay playsInline muted preload="metadata" aria-label="Drape in motion" src={film} /> :
            <img key={image} className={view==='detail'?styles.closeUp:styles.fullPhoto} style={view==='detail'?{objectPosition:'50% '+focus+'%',transformOrigin:'50% '+focus+'%'}:undefined} src={image} alt={garment?.alt||look.shade+' saree worn head to toe with juttis and jewellery'} fetchPriority="high"/>}
          {view==='full'&&!garment&&<div className={styles.sideDetail} aria-hidden="true"><img src={image} alt=""/></div>}
          {view!=='film'&&<button className={styles.expand} aria-label="Open full-length photograph" onClick={()=>setLightbox(true)}><Maximize2 size={17}/></button>}
          {view==='detail'&&<label className={styles.focus}>Explore the detail<input type="range" min="0" max="100" value={focus} onChange={e=>setFocus(Number(e.target.value))} aria-label="Move from shoulder to hem"/></label>}
        </div>
        <div className={styles.viewNav}><button aria-pressed={view==='full'} onClick={()=>switchView('full')}>Full look</button><button aria-pressed={view==='detail'} onClick={()=>switchView('detail')}>Up close</button>{film&&<button aria-pressed={view==='film'} onClick={()=>switchView('film')}><Play size={13}/> {garment?'Watch the drape':'Drape study'}</button>}</div>
      </div>
      <div className={styles.copy}>
        <p className={styles.kicker}>Neejee &nbsp;/&nbsp; The lookbook</p>
        <h1>{name}</h1>
        <p className={styles.occasion}>{garment?garment.description:look.occasion}</p>
        <p className={styles.description}>{garment?'Choose a jutti and a piece of jewellery to wear with it. Open the photograph to take a closer look at the finish.':look.description}</p>
        <div className={styles.pairStrip} aria-label="Your selected pairing">
          {([{slot:'shoe',item:shoe,label:'Jutti'},{slot:'jewel',item:jewel,label:'Jewellery'}] as const).map(({slot,item,label})=><button key={slot} onClick={()=>seeTray(slot)} aria-label={'Change '+label.toLowerCase()}>{item?<img src={item.image} alt=""/>:<span className={styles.emptyAccessory}>+</span>}<span>{item?.name||'Choose '+label.toLowerCase()}</span></button>)}
        </div>
        <div className={styles.ctas}><button className={styles.primary} onClick={()=>seeTray()}>Style this look</button>{allPresent&&(!garment||garment.mirrorHref)&&<Link className={styles.mirror} href={mirror}><Sparkles size={16}/> {personalMirror?'See it on me':'Explore AI Mirror'}</Link>}</div>
        <p className={styles.credit}>{garment?<Link href={garment.href}>Shop this piece · {garment.price}</Link>:'Editorial styling study · AI imagery'}</p>
      </div>
    </div>
    <nav className={styles.quick} aria-label="Browse the shop"><Link href="/edits/sarees">Sarees</Link><Link href="/edits/suits">Suit sets</Link><Link href="/counter">Match my blouse</Link><Link href="/edits/home">For the home</Link></nav>
    <section className={styles.tray} ref={tray} tabIndex={-1} id="styling-tray" aria-labelledby="tray-heading">
      <div className={styles.trayHead}><div><p className={styles.kicker}>Your styling tray</p><h2 id="tray-heading">The finishing touches.</h2></div>
        {restore&&<Link href={restore} className={styles.savedLink}>Open my saved look</Link>}</div>
      {items.length>0&&<label className={styles.stock}>Style a piece from the shop <select value={garment?.id||''} onChange={e=>{setSelectedId(e.target.value);setView('full');setSaved('');}}><option value="">Editorial saree · {look.shade}</option>{items.map(g=><option key={g.id} value={g.id}>{g.name} · {g.description}</option>)}</select></label>}
      <div className={styles.trayLayout}><div>
        <div className={styles.tabs} role="group" aria-label="Choose accessory type"><button aria-pressed={picking==='shoe'} onClick={()=>setPicking('shoe')}>Juttis</button><button aria-pressed={picking==='jewel'} onClick={()=>setPicking('jewel')}>Jewellery</button></div>
        <div className={styles.options}>{options.filter(item=>item.slot===picking).map(item=><button key={item.id} onClick={()=>changeAccessory(item.id)} aria-pressed={choice[picking]===item.id}><span><img src={item.image} alt="" loading="lazy"/>{choice[picking]===item.id&&<b><Check size={15}/></b>}</span>{item.name}{item.price&&<small className={styles.optionPrice}>{item.price}</small>}</button>)}</div>
        <button className={styles.skip} aria-pressed={choice[picking]==='none'} onClick={()=>changeAccessory('none')}>Leave out {picking==='shoe'?'the juttis':'the jewellery'}</button>
        {(custom.current.shoe||custom.current.jewel)&&<button className={styles.reset} onClick={useSuggestedPair}>Restore suggested pairing</button>}
      </div><aside className={styles.summary}><div className={styles.composition} aria-label="Your outfit laid out together">
          <img className={styles.garmentThumb} src={image} alt={name} loading="lazy"/>
          {[shoe,jewel].map((item,i)=>item?<img key={item.id} src={item.image} alt={item.name} loading="lazy"/>:<span key={i}>{i?'No jewellery selected':'No jutti selected'}</span>)}
        </div><h3>Your look</h3><p>{[name,shoe?.name,jewel?.name].filter(Boolean).join(' · ')}</p>
        <p className={styles.subtle}>{personalMirror?'Your Mirror preview uses your selected pieces.':'Save your selections or explore a sample fitting in AI Mirror.'} Priced accessories are available in the shop.</p>
        {!allPresent&&<p role="status">One of your saved accessories has sold or moved. Choose another to try the look.</p>}
        {[shoe,jewel].map(item=>item?.href&&<Link className={styles.savedLink} key={item.id} href={item.href}>{item.name} · {item.price}</Link>)}
        <div className={styles.ctas}>{allPresent&&(!garment||garment.mirrorHref)&&<Link className={styles.primary} href={mirror}>{personalMirror?'Try my look in AI Mirror':'See a sample fitting'}</Link>}
          <button onClick={save} className={styles.save}><Bookmark size={16}/> Save look</button></div>
        {saved&&<p role="status">{saved} <Link href={address}>Open look link</Link></p>}
        {garment&&<Link className={styles.savedLink} href={garment.href}>View this piece · {garment.price}</Link>}
      </aside></div>
    </section>
    {standalone&&<div className={styles.quick}><Link href="/counter">Compare two sarees at the saree counter</Link></div>}
    <dialog ref={dialog} onCancel={()=>setLightbox(false)} onClick={e=>{if(e.target===dialog.current)setLightbox(false);}} className={styles.lightbox}><button aria-label="Close photograph" onClick={()=>setLightbox(false)}><X/></button><img src={image} alt={name+' in full length'}/></dialog>
  </section>;
}
