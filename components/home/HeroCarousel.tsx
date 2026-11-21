'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
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
}

const fallback: HeroBanner = {
  id: 'default', title: 'Found. Personal.', subtitle: null,
  image: null, ctaText: 'Our story', ctaUrl: '/about',
};

export function HeroCarousel({ banners, spotlight }: { banners: HeroBanner[]; spotlight: Spotlight | null }) {
  const slides = banners.length || spotlight ? banners : [fallback];
  const count = slides.length + (spotlight ? 1 : 0);
  const [index, setIndex] = useState(0);
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
        if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
      }}>
      {piece ? (
        <div className={styles.feature}>
          <div className={styles.copy}>
            <p className={styles.kicker}>{piece.curated ? 'The founder’s edit' : 'New to NEEJEE'}</p>
            <h1 className={styles.title}>{piece.title}</h1>
            {piece.subtitle && <p className={styles.line}>{piece.subtitle}</p>}
            {piece.origin && <p className={styles.origin}>{piece.origin}</p>}
            <div className={styles.actions}>
              <Link className={styles.cta} href={piece.href}>Explore the piece</Link>
              <span className={styles.price}>{piece.price}</span>
            </div>
          </div>
          <Link href={piece.href} aria-label={piece.name} className={styles.photo}>
            {/* Approved catalogue images may be served from different media providers. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={piece.image} alt={piece.name} fetchPriority="high" />
          </Link>
        </div>
      ) : (
        <div className={styles.campaign}>
          {banner.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={banner.image} alt="" fetchPriority={active === 0 ? 'high' : 'auto'} />
          )}
          <div className={styles.campaignCopy}>
            <p className={styles.kicker}>NEEJEE</p>
            <h1 className={styles.title}>{banner.title || 'Found. Personal.'}</h1>
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
