'use client';

import Link from 'next/link';
import { useEffect,useRef,useState } from 'react';
import { Eye, Users } from 'lucide-react';
import { counterHref,firstPair,rankedCloths,readCounter,safeHex,shadeName,shades,type CounterCloth,type CounterLink,type CounterState } from '@/lib/counter';
import { PhotoSwatch } from './PhotoSwatch';
import { SourcingNote } from './SourcingNote';
import { CounterShare } from './CounterShare';
import styles from './Counter.module.css';

const storageKey='neejee.counter.v1';

function initialState(items:CounterCloth[],link:CounterLink):CounterState {
  const colour=link.colour||shades[0].hex;
  if(link.mode!=='mine') return {colour,one:link.one,two:link.two};
  const pair=firstPair(items,colour);
  const one=link.one||pair[0];
  const two=link.two||pair.find(id=>id!==one)||items.find(item=>item.id!==one)?.id||'';
  return {one,two,colour};
}

function PieceNote({cloth,slot,guest,pick,onPick}:{cloth:CounterCloth;slot:string;guest:boolean;pick:string;onPick:()=>void}){
  return <div className={styles.pieceNote}>
    <div className={styles.pieceLabel}><span>{slot} · {cloth.kind==='archive'?'Archive study':'In the shop'}</span>{pick===cloth.id&&<strong>Your guest’s pick</strong>}</div>
    <h2>{cloth.name}</h2><p>{cloth.description}</p>
    {cloth.kind==='archive'?<a href={cloth.href} className={styles.noteLink}>View museum record · {cloth.credit}</a>:<div className={styles.pieceLinks}><Link className={styles.noteLink} href={cloth.href}>Shop this piece · {cloth.price}</Link>{cloth.mirrorHref&&<Link className={styles.noteLink} href={cloth.mirrorHref}>Try in AI Mirror</Link>}</div>}
    {guest&&<button className={styles.vote} aria-label={'Pick '+cloth.name} onClick={onPick}>I’d pick this one</button>}
  </div>;
}

export function CounterStudio({items,link,photoStart,stockError,contactEmail}:{contactEmail:string;items:CounterCloth[];link:CounterLink;photoStart:boolean;stockError:boolean}) {
  const [state,setState]=useState(()=>initialState(items,link));
  const [ready,setReady]=useState(false);
  const [split,setSplit]=useState(50);
  const [whole,setWhole]=useState(false);
  const [photoOpen,setPhotoOpen]=useState(photoStart);
  const [photo,setPhoto]=useState('');
  const [share,setShare]=useState<'ask'|'vote'|null>(null);
  const [vote,setVote]=useState('');
  const [saved,setSaved]=useState('');
  const [contrast,setContrast]=useState(false);
  const [localMode,setLocalMode]=useState(false);
  const photoDetails=useRef<HTMLDetailsElement>(null);
  const mode=localMode?'mine':link.mode;
  const guest=mode==='ask',received=mode==='reply';
  const one=items.find(item=>item.id===state.one),two=items.find(item=>item.id===state.two);
  const stock=items.filter(item=>item.kind==='shop');
  useEffect(()=>{
    // Explicit invitation links take precedence over the visitor's personal counter.
    if(!link.one&&!link.two&&!link.colour&&link.mode==='mine'){
      try {const text=localStorage.getItem(storageKey);if(text){const prior=readCounter(new URLSearchParams(text));if(prior.colour&&prior.one&&prior.two)setState(initialState(items,prior));}}catch{}
    }
    setReady(true);
  },[items,link]);
  function updateColour(hex:string){
    if(!safeHex(hex))return;
    setState(s=>({...s,colour:hex}));setSaved('');
  }
  function changePiece(side:'one'|'two',id:string) {
    const other=side==='one'?'two':'one';
    setState(s=>({...s,[side]:id,[other]:s[other]===id?s[side]:s[other]}));
    setSaved('');
  }
  function suggest(opposite:boolean) {
    const pair=firstPair(items,state.colour,opposite);
    setState(s=>({...s,one:pair[0],two:pair[1]}));
    setContrast(opposite);setSplit(50);setSaved('');
  }
  function saveCounter() {
    try{localStorage.setItem(storageKey,counterHref(state).split('?')[1]);setSaved('Saved on this device. Your photo stays in this tab.');}
    catch {setSaved('This browser couldn’t save the counter. Bookmark the link below.');}
  }
  const sorted=rankedCloths(items,state.colour,contrast);
  return <main className={styles.studio}>
    <div className={styles.counterTop}><Link href="/">Neejee</Link><span>/</span><span>The saree counter</span><Link href="/edits/clothing">Shop clothing</Link></div>
    <header className={styles.studioHeader}><div><p className={styles.eyebrow}><span lang="hi">साथ बैठें</span> {guest?'An invitation':received?'A reply from your guest':'The saree counter'}</p>
      <h1>{guest?'Which one feels like me?':received?'Look what they chose.':'Lay them together.'}</h1></div>
      <p>{guest?'Someone has set two pieces aside for your eye. Draw the cloth across, then send your favourite back.':received?'Your guest’s choice is marked below. Unfold both pieces again, or follow the one you love.':'Start with a blouse, a bangle, or a colour you love. Pull the edge to see which cloth belongs beside it.'}</p>
    </header>
    {!guest&&!received&&<div className={styles.swatchDesk}>
      <div className={styles.colourControls}><span className={styles.controlTitle}>Your colour</span><div className={styles.shadeRow} role="group" aria-label="Your colour">{shades.map(s=><button key={s.hex} aria-label={s.name} aria-pressed={state.colour===s.hex} title={s.name} onClick={()=>updateColour(s.hex)}><i style={{background:s.hex}}/></button>)}</div>
      <label className={styles.customSwatch}>Mix a shade<input type="color" value={state.colour} aria-label="Mix a custom shade" onChange={e=>updateColour(e.target.value)}/></label></div>
      <details className={styles.photoDetails} ref={photoDetails} open={photoOpen} onToggle={e=>setPhotoOpen(e.currentTarget.open)}><summary>Pick from my photograph</summary>
        <PhotoSwatch onPick={updateColour} onPhoto={setPhoto}/></details>
    </div>}
    {!one || !two ? <section className={styles.missing}><h2>One of these pieces has left the counter.</h2><p>{stockError?'The shop catalogue could not be reached. You can reopen this link later.':'An item may have sold or moved out of the collection.'}</p>
      <Link className={styles.primary} href={counterHref({colour:state.colour,one:'',two:''})}>Set out a fresh pair</Link></section>:
    <>
      <div className={styles.boardTools}><div><span className={styles.threadDot} style={{background:state.colour}}/><span>{guest||received?'Their colour':'Your colour'} · <b>{shadeName(state.colour)}</b></span></div>
      <button className={styles.textButton} aria-pressed={whole} onClick={()=>setWhole(!whole)}><Eye size={16}/>{whole?'Compare the details':'See the full photographs'}</button></div>
      <div className={whole?styles.whole:styles.wipe} aria-label="Two pieces at the counter">
        {whole?<><figure><img src={one.image} alt={one.alt}/></figure><figure><img src={two.image} alt={two.alt}/></figure></>:
          <>
            <img className={styles.rightCloth} src={two.detailImage||two.image} alt={two.alt}/>
            <img className={styles.leftCloth} src={one.detailImage||one.image} alt={one.alt} style={{clipPath:'inset(0 '+(100-split)+'% 0 0)'}}/>
            <div className={styles.seam} style={{left:split+'%',backgroundColor:state.colour}}><span aria-hidden="true">‹ &nbsp; ›</span></div>
            <input type="range" min="5" max="95" value={split} onChange={e=>setSplit(Number(e.target.value))} aria-label="Unfold the left piece" aria-valuetext={split+' percent left piece'} className={styles.slider}/>
          </>}
        {photo&&!guest&&!received&&<div className={styles.ownPhoto}><img src={photo} alt="Your item for comparison"/><span>Yours</span></div>}
      </div>
      <div className={styles.pieceNotes}><PieceNote cloth={one} slot="Left" guest={guest} pick={received?link.pick:''} onPick={()=>{setVote(one.id);setShare('vote');}}/><PieceNote cloth={two} slot="Right" guest={guest} pick={received?link.pick:''} onPick={()=>{setVote(two.id);setShare('vote');}}/></div>
      {!guest&&!received&&<section className={styles.editStrip} aria-label="Change the pieces">
        {(['one','two'] as const).map((side,i)=><label key={side}>Change the {i?'right':'left'} piece<select value={state[side]} onChange={e=>changePiece(side,e.target.value)}>{(['shop','archive'] as const).map(kind=>{
          const choices=sorted.filter(item=>item.kind===kind);
          return choices.length>0&&<optgroup key={kind} label={kind==='shop'?'In the shop':'Textile archive · study pieces'}>{choices.map(item=><option key={item.id} value={item.id}>{item.name}{kind==='shop'&&item.description?' · '+item.description:''}</option>)}</optgroup>;
        })}</select></label>)}
        <div className={styles.matchButtons}><span>Suggest a pair</span><button onClick={()=>suggest(false)}>Close in colour</button><button onClick={()=>suggest(true)}>More contrast</button></div>
      </section>}
      {!guest&&!received&&<div className={styles.sendRow}><div><p className={styles.eyebrow}>A second pair of eyes</p><h2>“Which one would you take?”</h2></div><div className={styles.actions}><button className={styles.primary} onClick={()=>setShare('ask')}><Users size={17}/> Ask someone</button><button className={styles.textButton} disabled={!ready} onClick={saveCounter}>Save my counter</button></div></div>}
      {saved&&<p role="status" className={styles.saveMessage}>{saved} <Link href={counterHref(state)}>Open saved link</Link></p>}
      {received&&<div className={styles.actions}><button className={styles.primary} onClick={()=>{setLocalMode(true);setSaved('');}}>Make this my counter</button></div>}
      {!guest && (one.kind==='archive' || two.kind==='archive') && <SourcingNote key={[one.id,two.id].join('_')} email={contactEmail} pieces={[one,two].filter(piece=>piece.kind==='archive')} colour={state.colour} selected={received?link.pick:''}/>}
      {!stock.length&&<p className={styles.stockNote}>{stockError?'The shop is temporarily unavailable. The archive is open.':'The fashion edit is being prepared. Museum textiles are here to explore and compare.'} <Link href="/products">Browse available pieces</Link></p>}
    </>}
    {share&&<CounterShare state={state} pick={share==='vote'?vote:undefined} onClose={()=>setShare(null)}/>}
  </main>;
}
