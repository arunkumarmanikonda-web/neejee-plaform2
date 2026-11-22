'use client';

import Link from 'next/link';
import { usePhotoRail } from '@/components/gallery/usePhotoRail';
import { lookUrl, defaultStyling } from '@/lib/stylebook';
import styles from './HouseCampaign.module.css';

const edits = [
  {
    id: 'surkh', name: 'Surkh', hindi: 'सुर्ख', colour: '#9c352f',
    line: 'Vermilion with fine gold checks and a deep wine pallu.',
    image: '/brand/campaign/vermilion.webp', mobile: '/brand/campaign/vermilion-mobile.webp',
    alt: 'The Surkh saree in afternoon light, its red checks edged with wine and gold.',
  },
  {
    id: 'neel', name: 'Neel', hindi: 'नील', colour: '#28405d',
    line: 'Ivory dots gather into diamonds across deep indigo.',
    image: '/brand/campaign/indigo-detail.webp', mobile: '/brand/campaign/indigo-detail.webp',
    alt: 'Close folds of the Neel saree showing ivory dotted diamonds and a striped edge.',
  },
];

export function HouseCampaign() {
  const rail = usePhotoRail(edits.length);
  return <section className={styles.campaign} aria-label="Featured sarees" aria-roledescription="carousel" onKeyDown={rail.onKeyDown}>
    <div className={'photo-rail '+styles.track} {...rail.props}>
      {edits.map((edit, i) => <div className={styles.panel} data-slide="" data-edit={edit.id} key={edit.id} aria-hidden={rail.active!==i}>
        <picture className={styles.photograph}>
          <source media="(max-width: 650px)" srcSet={edit.mobile}/>
          <img src={edit.image} alt={edit.alt} width="1800" height="800" draggable={false}
            fetchPriority={i===0 ? 'high' : 'low'} decoding="async"/>
        </picture>
        <div className={styles.shade}/>
        <div className={styles.content}>
          <p className={styles.label}>The saree edit</p>
          <h1>{edit.name}<span lang="hi">{edit.hindi}</span></h1>
          <p className={styles.line}>{edit.line}</p>
          <div className={styles.links}>
            <Link className={styles.primary} tabIndex={rail.active===i ? 0 : -1} href="/edits/sarees">Shop sarees</Link>
            <Link className={styles.secondary} tabIndex={rail.active===i ? 0 : -1} href={lookUrl('/looks', defaultStyling(edit.id))}>Style this look</Link>
          </div>
        </div>
      </div>)}
    </div>
    <div className={styles.selector} role="group" aria-label="Choose a featured saree">
      {edits.map((item, i) => <button type="button" key={item.id} aria-pressed={rail.active === i}
        onClick={() => rail.go(i)}><i style={{ backgroundColor: item.colour }}/>{item.name}</button>)}
    </div>
  </section>;
}

export function ShopDepartments() {
  const rooms = [
    { name: 'Sarees', href: '/edits/sarees', photo: '/brand/study-views/haldi.webp', where: '53% 58%', alt: 'Golden yellow saree folds with a maroon temple border' },
    { name: 'Suit sets', href: '/edits/suits', photo: '/brand/bazaar/wine-suit.webp', where: '50% 31%', alt: 'A wine floral kurta and the edge of an ivory dupatta' },
    { name: 'Home & objects', href: '/edits/home', photo: '/brand/house/home-objects.webp', where: '59% 51%', alt: 'Brass, marigolds and blue pottery on a wooden table' },
  ];
  return <nav className={styles.rooms} aria-label="Shop by department">
    {rooms.map(r => <Link key={r.href} href={r.href}>
      <span className={styles.roomImage}><img src={r.photo} alt={r.alt} loading="lazy" style={{objectPosition:r.where}}/></span>
      <span className={styles.roomName}>{r.name}</span>
    </Link>)}
  </nav>;
}
