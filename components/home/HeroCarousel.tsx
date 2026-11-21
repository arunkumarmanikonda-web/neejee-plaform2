'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { ShareFind } from '@/components/product/ShareFind';
import styles from './HeroCarousel.module.css';

interface HeroBanner {
  id: string;
  title: string | null;
  subtitle: string | null;
  image: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
}

interface Spotlight {
  name: string;
  title: string;
  subtitle: string | null;
  origin: string;
  image: string;
  price: string;
  href: string;
  curated: boolean;
  gallery: string[];
  material: string | null;
  roomHref: string | null;
  mirrorHref: string | null;
}

const fallback: HeroBanner = {
  id: 'default', title: 'Found. Personal.', subtitle: null,
  image: null, ctaText: 'Our story', ctaUrl: '/about',
};

export function HeroCarousel({ banners, spotlight }: { banners: HeroBanner[]; spotlight: Spotlight | null }) {
  const slides = banners.length || spotlight ? banners : [fallback];
  const count = slides.length + (spotlight ? 1 : 0);
  const [index, setIndex] = useState(0);
  const [photoIndex,setPhotoIndex]=useState(0);
  const [playing, setPlaying] = useState(false);
  const [hover, setHover] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const active = Math.min(index, count - 1);
  const piece = active === 0 ? spotlight : null;
  const banner = slides[active - (spotlight ? 1 : 0)];

  useEffect(() => {
    if (!spotlight && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPlaying(true);
  }, [spotlight]);
  useEffect(() => {
    if (!playing || hover || count < 2) return;
    const timer = setInterval(() => setIndex(i => (i + 1) % count), 7000);
    return () => clearInterval(timer);
  }, [playing, hover, count]);

  function step(direction: number) {
    setPlaying(false);
    setIndex((active + direction + count) % count);
  }

  return (
    <section aria-label="Featured at NEEJEE" aria-roledescription="carousel" className={styles.hero}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setPlaying(false)}
      onTouchStart={e => { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={e => {
        if (!touchStart.current || count < 2) return;
        const dx = e.changedTouches[0].clientX - touchStart.current.x;
        const dy = e.changedTouches[0].clientY - touchStart.current.y;
        touchStart.current = null;
        if ((e.target as HTMLElement).closest('[data-photo-gallery]')) return;
        if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
      }}>
      {piece ? (
        <div className={styles.feature}>
          <div className={styles.copy}>
            <p className={styles.kicker}>{piece.curated ? 'From the founder’s edit' : 'New in the shop'}</p>
            <h2 className={styles.title}>{piece.title}</h2>
            {piece.subtitle && <p className={styles.line}>{piece.subtitle}</p>}
            <dl className={styles.facts}>{[['Origin',piece.origin],['Material',piece.material]].map(([label,value])=>value && <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            <div className={styles.actions}><Link className={styles.cta} href={piece.href}>Shop this piece <span>{piece.price}</span></Link>
              {piece.roomHref && <Link className={styles.studioLink} href={piece.roomHref}>See it in my room</Link>}
              {piece.mirrorHref && <Link className={styles.studioLink} href={piece.mirrorHref}>Try it on in Mirror</Link>}</div>
            <ShareFind href={piece.href} name={piece.name}/>
          </div>
          <div className={styles.gallery} data-photo-gallery>
            <Link href={piece.href} aria-label={piece.name} className={styles.photo}>
              <img src={piece.gallery[photoIndex] || piece.image} alt={piece.name} fetchPriority="high" />
            </Link>
            {piece.gallery.length>1 && <div className={styles.film} aria-label="Photographs of the featured piece">
              {piece.gallery.map((src,i)=><button type="button" key={src} aria-label={'View photograph '+(i+1)} aria-pressed={photoIndex===i} onClick={()=>{setPlaying(false);setPhotoIndex(i);}}>
                <img src={src} alt="" loading="lazy"/></button>)}
            </div>}
          </div>
        </div>
      ) : (
        <div className={styles.campaign}>
          {banner.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={banner.image} alt="" fetchPriority={active === 0 ? 'high' : 'auto'} />
          )}
          <div className={styles.campaignCopy}>
            <p className={styles.kicker}>NEEJEE</p>
            <h2 className={styles.title}>{banner.title || 'Found. Personal.'}</h2>
            {banner.subtitle && <p className={styles.line}>{banner.subtitle}</p>}
            <Link className={styles.cta} href={banner.ctaUrl || '/products'}>{banner.ctaText || 'Explore the collection'}</Link>
          </div>
        </div>
      )}
      {count > 1 && (
        <div className={styles.controls}>
          <button type="button" aria-label="Previous feature" onClick={() => step(-1)}><ChevronLeft size={18} /></button>
          <span aria-live={playing ? 'off' : 'polite'}>{active + 1} / {count}</span>
          <button type="button" aria-label="Next feature" onClick={() => step(1)}><ChevronRight size={18} /></button>
          <button type="button" aria-label={playing ? 'Pause slideshow' : 'Play slideshow'} onClick={() => setPlaying(!playing)}>
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
        </div>
      )}
    </section>
  );
}
