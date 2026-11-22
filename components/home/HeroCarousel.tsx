'use client';

import { useEffect, useState } from 'react';
import { usePhotoRail } from '@/components/gallery/usePhotoRail';
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
  const rail = usePhotoRail(count);
  const { active, go } = rail;
  const piece = spotlight;
  const [photoIndex,setPhotoIndex]=useState(0);
  const [playing, setPlaying] = useState(false);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    if (!playing || hover || count < 2) return;
    const timer = setTimeout(() => { if (active === count - 1) setPlaying(false); else go(active + 1); }, 7000);
    return () => clearTimeout(timer);
  }, [playing, hover, count, active, go]);

  return (
    <section aria-label="Featured at NEEJEE" aria-roledescription="carousel" className={styles.hero}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setPlaying(false)} onTouchStart={() => setPlaying(false)} onKeyDown={rail.onKeyDown}>
      <div className="photo-rail" {...rail.props}>
      {piece && (
        <div data-slide="" className={styles.feature} aria-hidden={active!==0}
          ref={el=>{el?.toggleAttribute('inert',active!==0);}}>
          <div className={styles.copy}>
            <p className={styles.kicker}>{piece.curated ? 'From the founder’s edit' : 'New in the shop'}</p>
            <h2 className={styles.title}>{piece.title}</h2>
            {piece.subtitle && <p className={styles.line}>{piece.subtitle}</p>}
            <dl className={styles.facts}>{[['Origin',piece.origin],['Material',piece.material]].map(([label,value])=>value && <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            <div className={styles.actions}><Link className={styles.cta} href={piece.href}>Shop this piece <span>{piece.price}</span></Link>
              {piece.roomHref && <Link className={styles.studioLink} href={piece.roomHref}>See it in my room</Link>}
              {piece.mirrorHref && <Link className={styles.studioLink} href={piece.mirrorHref}>Try it on in Aaina</Link>}</div>
            <ShareFind href={piece.href} name={piece.name}/>
          </div>
          <div className={styles.gallery} data-photo-gallery>
            <Link href={piece.href} aria-label={piece.name} className={styles.photo}>
              {(piece.gallery.length ? piece.gallery : [piece.image]).map((src,i)=>
                <img key={src} src={src} alt={i===photoIndex ? piece.name : ''} aria-hidden={i!==photoIndex}
                  className={styles.layer} data-visible={i===photoIndex} decoding="async" loading={i ? 'lazy' : 'eager'}/>)}

            </Link>
            {piece.gallery.length>1 && <div className={styles.film} aria-label="Photographs of the featured piece">
              {piece.gallery.map((src,i)=><button type="button" key={src} aria-label={'View photograph '+(i+1)} aria-pressed={photoIndex===i} onClick={()=>{setPlaying(false);setPhotoIndex(i);}}>
                <img src={src} alt="" loading="lazy"/></button>)}
            </div>}
          </div>
        </div>
      )}
      {slides.map((banner,i) => <div key={banner.id} data-slide="" className={styles.campaign}
        aria-hidden={active!==i+(piece?1:0)} ref={el=>{el?.toggleAttribute('inert',active!==i+(piece?1:0));}}>
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
        </div>)}
      </div>
      {count > 1 && (
        <div className={styles.controls}>
          <button type="button" aria-label="Previous feature" aria-disabled={active===0} onClick={() => rail.step(-1)}><ChevronLeft size={18} /></button>
          <span aria-live={playing ? 'off' : 'polite'}>{active + 1} / {count}</span>
          <button type="button" aria-label="Next feature" aria-disabled={active===count-1} onClick={() => rail.step(1)}><ChevronRight size={18} /></button>
          <button type="button" aria-label={playing ? 'Pause slideshow' : 'Play slideshow'} onClick={() => {if (!playing && active===count-1) go(0);setPlaying(!playing);}}>
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
        </div>
      )}
    </section>
  );
}
