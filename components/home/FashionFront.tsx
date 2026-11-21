'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, ArrowRight } from 'lucide-react';
import { editHref, shopEdits } from '@/lib/shop-edits';
import { studioHref } from '@/lib/studio';
import { formatINR } from '@/lib/money';
import type { editLead } from '@/lib/shop-edit-catalog';
import styles from './FashionFront.module.css';

type Lead=Awaited<ReturnType<typeof editLead>>;
export function FashionFront({saree,suit}:{saree:Lead;suit:Lead}) {
  const [suits,setSuits]=useState(false);
  const edit=shopEdits[suits?1:0];
  const lead=suits?suit:saree;
  return <section className={styles.front} aria-label="The Neejee fashion edit">
    <div className={styles.copy}>
      <div className={styles.switch} role="group" aria-label="Choose a fashion edit">
        <button aria-pressed={!suits} onClick={()=>setSuits(false)}>Sarees</button>
        <button aria-pressed={suits} onClick={()=>setSuits(true)}>Suits</button>
      </div>
      <div className={styles.story} aria-live="polite">
        <h1>{edit.headline}</h1>
        <p>{edit.note}</p>
        <div className={styles.actions}><Link href={editHref(edit.slug)} className={styles.primary}>Explore the {suits?'suit':'saree'} edit <ArrowRight size={18}/></Link>
          {lead?.mirror && <Link href={studioHref('mirror',lead.slug)}>Try it in Mirror</Link>}</div>
      </div>
      <div className={styles.signature}><span>Neejee</span>Found. Personal.</div>
    </div>
    <figure className={styles.frame} data-portrait={suits && !lead?.cover}>
      <img key={lead?.cover||edit.image} src={lead?.cover||edit.image} alt={lead?.name||edit.alt} fetchPriority="high" width="960" height="600" />
      {lead?.cover ? <Link className={styles.caption} href={'/products/'+lead.slug}>{lead.name} · {formatINR(lead.price)} <ArrowUpRight size={14}/></Link> :
        <figcaption className={styles.caption}>From our visual notebook <span>·</span> <Link href={editHref(edit.slug)+'#photograph'}>Photo credit</Link></figcaption>}
    </figure>
  </section>;
}
