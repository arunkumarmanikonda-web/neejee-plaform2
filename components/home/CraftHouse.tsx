'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import styles from './CraftHouse.module.css';

const chapters=[
  {tab:'At the loom',place:'Banaras',heading:'It began with a saree.',body:'Ramji bhai wove the saree in Banaras over fourteen days. Nidhi’s letter begins with that piece and the hands behind it.',image:'/brand/journey-loom.webp',alt:'A weaver reaches across a handloom in Varanasi, with coloured bobbins resting on pale cloth.',caption:'A working loom, Varanasi · 2011',by:'Dan Ruth',source:'https://commons.wikimedia.org/wiki/File:Silk_Looms,_Varanasi.jpg',lic:'CC BY 2.0',licurl:'https://creativecommons.org/licenses/by/2.0/',processing:'Cropped and resized',link:'/edits/clothing',action:'Explore clothing'},
  {tab:'In the home',place:'Chettinad',heading:'A room of one’s own.',body:'A writing chest, a striped mat, the little circle of light beside a chair. Some objects become so much a part of a room that you miss them the moment they move.',image:'/brand/studio-imagine.webp',alt:'A writing chest and striped mat in a Chettinad study.',caption:'A study in Chettinad',by:'Ravindraboopathi',source:'https://commons.wikimedia.org/wiki/File:Chettinadu_study_Room.jpeg',lic:'CC BY-SA 3.0',licurl:'https://creativecommons.org/licenses/by-sa/3.0/',processing:'Cropped and resized',link:'/edits/home',action:'Explore objects for home'},
  {tab:'In the wood',place:'New Delhi',heading:'Furniture with a past.',body:'Look closely at the painted panels and turned legs of this museum bed. Furniture is the next chapter for Neejee. This is a page from our reference book, a way to look at the work before the collection arrives.',image:'/brand/journey-furniture.webp',alt:'A low wooden bed with painted panels, carved figures and turned legs in the Crafts Museum, New Delhi.',caption:'Decorated bed · Crafts Museum, New Delhi',by:'© Yann Forget / Wikimedia Commons',source:'https://commons.wikimedia.org/wiki/File:Decorated_bed,_Crafts_Museum,_Delhi.jpg',lic:'CC BY-SA 4.0',licurl:'https://creativecommons.org/licenses/by-sa/4.0/',processing:'Resized',link:'/edits/furniture',action:'Explore furniture'}
] as const;
export function CraftHouse() {
  const [index,setIndex]=useState(0);
  const c=chapters[index];
  return <section className={styles.house} aria-label="Nidhi’s craft notebook">
    <div className={styles.spread}>
      <div className={styles.leaf}>
        <div className={styles.byline}><span lang="hi">निजी</span><i/>Nidhi’s craft notebook</div>
        <div className={styles.words} aria-live="polite" aria-atomic="true">
          <h2>{c.heading}</h2><p>{c.body}</p>
          <div className={styles.links}><Link href={c.link}>{c.action}<ArrowRight size={16}/></Link>
            <Link href={index===0?'#founder-letter':'/products'}>{index===0?'Read Nidhi’s letter':'Shop available pieces'}</Link></div>
        </div>
        <div className={styles.chooser} role="group" aria-label="Turn the notebook page">{chapters.map((chapter,i)=><button key={chapter.tab} aria-pressed={index===i} onClick={()=>setIndex(i)}>{chapter.tab}</button>)}</div>
      </div>
      <figure className={styles.plate} data-page={index}>
        <div className={styles.photo}><img key={c.image} src={c.image} alt={c.alt} fetchPriority={index===0?'high':'auto'}/></div>
        <figcaption><span>{c.caption}</span><small><a href={c.source}>{c.by}</a> · <a href={c.licurl}>{c.lic}</a> · {c.processing}</small></figcaption>
      </figure>
    </div>
    <nav aria-label="Inside Neejee" className={styles.shelves}><Link href="/edits/clothing">Clothing <span>Sarees &amp; suits</span></Link><Link href="/edits/home">Home &amp; objects <span>Décor &amp; artefacts</span></Link><Link href="/edits/furniture">Furniture <span>The next collection</span></Link></nav>
  </section>;
}
