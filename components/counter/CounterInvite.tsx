'use client';

import Link from 'next/link';
import { useState } from 'react';
import { shades, rankedCloths, counterHref } from '@/lib/counter';
import { archiveCloths } from '@/lib/counter-archive';
import styles from './Counter.module.css';

export function CounterInvite() {
  const [selected,setSelected]=useState(shades[0]);
  const cloth=rankedCloths(archiveCloths,selected.hex)[0];
  const next=counterHref({colour:selected.hex,one:cloth.id,two:''});
  return <section className={styles.invite} aria-label="Neejee saree counter">
    <div className={styles.inviteWords}>
      <p className={styles.kicker}><span lang="hi">रंग मिलाएँ</span> The saree counter</p>
      <h1>Bring the <br/><em>blouse.</em></h1>
      <p className={styles.inviteBody}>Have a blouse you love? Lay its colour beside two sarees. Ask someone who knows you which one feels like you.</p>
      <div className={styles.shadeRow} role="group" aria-label="Choose a starting colour">{shades.map(shade=><button key={shade.hex} onClick={()=>setSelected(shade)} aria-label={shade.name} aria-pressed={selected.hex===shade.hex} title={shade.name}><i style={{background:shade.hex}}/></button>)}<span aria-live="polite">{selected.name}</span></div>
      <div className={styles.entryActions}><Link href={next} className={styles.creamButton}>Unfold two sarees</Link><Link href="/counter?start=photo" className={styles.lightLink}>Start with my photograph</Link></div>
    </div>
    <figure className={styles.frontPlate}>
      <Link href={next} aria-label={'Unfold '+cloth.name} className={styles.frontPhoto}><img key={cloth.id} src={cloth.detailImage||cloth.image} alt={cloth.alt} fetchPriority="high"/></Link>
      <figcaption><div><span>From the textile archive</span><strong>{cloth.name}</strong></div><a href={cloth.href}>{cloth.credit}</a></figcaption>
    </figure>
    <nav className={styles.entryNav} aria-label="Shop directly"><Link href="/edits/sarees">Sarees</Link><Link href="/edits/suits">Suit sets</Link><Link href="/edits/home">For the home</Link><Link href="/products">Shop available pieces</Link></nav>
  </section>;
}
